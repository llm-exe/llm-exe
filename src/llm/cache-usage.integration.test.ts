import {
  createChatPrompt,
  createLlmExecutor,
  createParser,
  useLlm,
} from "@/index";
import type { OutputUsage } from "@/index";
import { apiRequest } from "@/utils/modules/request";

jest.mock("@/utils/modules/request", () => ({ apiRequest: jest.fn() }));
jest.mock("@/utils/modules/getAwsAuthorizationHeaders", () => ({
  getAwsAuthorizationHeaders: jest
    .fn()
    .mockResolvedValue({ Authorization: "test" }),
}));
const request = jest.mocked(apiRequest);

const totals = { input_tokens: 100, output_tokens: 20, total_tokens: 120 };
const completionUsage = {
  prompt_tokens: 100,
  completion_tokens: 20,
  total_tokens: 120,
};
const claudeUsage = {
  input_tokens: 10,
  output_tokens: 20,
  cache_read_input_tokens: 60,
  cache_creation_input_tokens: 30,
  cache_creation: {
    ephemeral_5m_input_tokens: 10,
    ephemeral_1h_input_tokens: 20,
  },
};
function respond(usage: Record<string, unknown> | undefined, headers = {}) {
  request.mockResolvedValue({
    data: {
      id: "response",
      model: "test-model",
      created: 1,
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Hello" }],
      choices: [
        {
          message: { role: "assistant", content: "Hello" },
          finish_reason: "stop",
        },
      ],
      candidates: [
        {
          content: { role: "model", parts: [{ text: "Hello" }] },
          finishReason: "STOP",
        },
      ],
      usage,
      usageMetadata: usage,
    },
    headers,
  });
}
beforeEach(() => request.mockReset());

it.each(["anthropic.chat.v1", "amazon:anthropic.chat.v1"] as const)(
  "%s includes cache reads and writes exactly once in totals",
  async (provider) => {
    respond(claudeUsage, { "x-amzn-bedrock-input-token-count": "999" });
    const output = await useLlm(provider, {
      model: "test-model",
      awsRegion: "us-east-1",
    }).call("Hi");
    expect(output.getResult().usage).toEqual({
      ...totals,
      cache_read_input_tokens: 60,
      cache_creation_input_tokens: 30,
      cache_creation: claudeUsage.cache_creation,
    });
  },
);

it.each([
  [
    "read only",
    { cache_read_input_tokens: 90 },
    { cache_read_input_tokens: 90 },
    100,
  ],
  [
    "write only",
    { cache_creation_input_tokens: 90 },
    { cache_creation_input_tokens: 90 },
    100,
  ],
  [
    "zero",
    { cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    { cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    10,
  ],
  ["absent", {}, {}, 10],
  [
    "null",
    {
      cache_read_input_tokens: null,
      cache_creation_input_tokens: null,
      cache_creation: null,
    },
    {},
    10,
  ],
])(
  "Anthropic handles %s cache usage",
  async (_name, cache, expected, inputTokens) => {
    respond({ input_tokens: 10, output_tokens: 20, ...cache });
    const output = await useLlm("anthropic.chat.v1", { model: "test" }).call(
      "Hi",
    );
    expect(output.getResult().usage).toEqual({
      input_tokens: inputTokens,
      output_tokens: 20,
      total_tokens: inputTokens + 20,
      ...expected,
    });
  },
);

it("preserves header-only Bedrock totals without inventing cache counts", async () => {
  respond(undefined, {
    "x-amzn-bedrock-input-token-count": "100",
    "x-amzn-bedrock-output-token-count": "20",
  });
  const output = await useLlm("amazon:anthropic.chat.v1", {
    model: "test",
    awsRegion: "us-east-1",
  }).call("Hi");
  expect(output.getResult().usage).toEqual(totals);
});

it.each(["openai.chat.v1", "xai.chat.v1", "deepseek.chat.v1"] as const)(
  "%s exposes cached input without adding it to existing totals",
  async (provider) => {
    respond({
      ...completionUsage,
      prompt_tokens_details: { cached_tokens: 60 },
    });
    const output = await useLlm(provider, { model: "test" }).call("Hi");
    expect(output.getResult().usage).toEqual({
      ...totals,
      cache_read_input_tokens: 60,
    });
  },
);

it("OpenAI preserves cache writes as a subset of prompt tokens", async () => {
  respond({
    ...completionUsage,
    prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 30 },
  });
  const output = await useLlm("openai.chat.v1", { model: "test" }).call("Hi");
  expect(output.getResult().usage).toEqual({
    ...totals,
    cache_read_input_tokens: 60,
    cache_creation_input_tokens: 30,
  });
});

it.each([0, 60])(
  "DeepSeek reads its native cache-hit count (%i) without treating misses as writes",
  async (hits) => {
    respond({
      ...completionUsage,
      prompt_cache_hit_tokens: hits,
      prompt_cache_miss_tokens: 100 - hits,
    });
    const output = await useLlm("deepseek.chat.v1", { model: "test" }).call(
      "Hi",
    );
    expect(output.getResult().usage).toEqual({
      ...totals,
      cache_read_input_tokens: hits,
    });
  },
);

it.each([undefined, null, {}, { cached_tokens: null }, { cached_tokens: 0 }])(
  "compatible responses preserve missing versus zero cache details: %j",
  async (details) => {
    respond({ ...completionUsage, prompt_tokens_details: details });
    const output = await useLlm("openai.chat.v1", { model: "test" }).call("Hi");
    expect(output.getResult().usage).toEqual({
      ...totals,
      ...(details?.cached_tokens === 0 ? { cache_read_input_tokens: 0 } : {}),
    });
  },
);

it.each([undefined, 0, 60])(
  "Gemini preserves its total (including thoughts) and cache count %s",
  async (cache) => {
    respond({
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 5,
      totalTokenCount: 125,
      cachedContentTokenCount: cache,
    });
    const output = await useLlm("google.chat.v1", { model: "test" }).call("Hi");
    expect(output.getResult().usage).toEqual({
      ...totals,
      total_tokens: 125,
      ...(cache !== undefined ? { cache_read_input_tokens: cache } : {}),
    });
  },
);

it("preserves typed usage in executor hooks and leaves parser output unchanged", async () => {
  respond(claudeUsage);
  let observed: OutputUsage | undefined;
  const executor = createLlmExecutor(
    {
      llm: useLlm("anthropic.chat.v1", { model: "test" }),
      prompt: createChatPrompt("Hi"),
      parser: createParser("string"),
    },
    {
      hooks: {
        onSuccess: (execution) => {
          observed = execution.handlerOutput?.getResult().usage;
        },
      },
    },
  );
  const result: string = await executor.execute({});
  expect(result).toBe("Hello");
  expect(observed).toEqual({
    ...totals,
    cache_read_input_tokens: 60,
    cache_creation_input_tokens: 30,
    cache_creation: claudeUsage.cache_creation,
  });
});
