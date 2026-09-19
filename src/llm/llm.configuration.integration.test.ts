import { useLlm, useLlmConfiguration } from "./llm";
import { createOpenAiCompatibleConfiguration } from "./config/openai/compatible";
import { apiRequest } from "@/utils/modules/request";
import { createLlmExecutor } from "@/executor";
import { createChatPrompt } from "@/prompt";
import { createParser } from "@/parser";
import * as awsSigning from "@/utils/modules/getAwsAuthorizationHeaders";
import { OutputDefault } from "./output/default";

jest.mock("@/utils/modules/request", () => ({ apiRequest: jest.fn() }));
const request = jest.mocked(apiRequest);

function requestBody() {
  return JSON.parse(request.mock.calls[0][1]?.body as string);
}

beforeEach(() => {
  request.mockReset().mockResolvedValue({
    data: {
      choices: [
        {
          message: { content: '{"name":"Ada"}', role: "assistant" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    },
    headers: {},
  });
});

it("passes raw body fields through the public DeepSeek path after all mappings", async () => {
  const extraBody = {
    thinking: { type: "disabled" },
    temperature: 0,
    response_format: { type: "text" },
    vendor: { enabled: false, values: [1, 2] },
  };
  await useLlm("deepseek.v4-flash", {
    temperature: 0.8,
    extraBody,
    deepseekApiKey: "test-key",
  }).call("Return JSON", { jsonSchema: { type: "object" } });
  expect(requestBody()).toEqual(
    expect.objectContaining({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "Return JSON" }],
      ...extraBody,
    }),
  );
  expect(requestBody()).not.toHaveProperty("extraBody");
  expect(extraBody.response_format).toEqual({ type: "text" });
});

it("supports extraBody on providers outside the OpenAI-compatible helper", async () => {
  await useLlm("anthropic.chat.v1", {
    model: "claude-sonnet-4-5",
    extraBody: { metadata: { user_id: "user-1" } },
  }).call("Hi");
  expect(requestBody().metadata).toEqual({ user_id: "user-1" });
});

it.each(["custom.chat.v1", "deepseek.chat.v1"])(
  "uses the supplied config for %s, including mappings, headers, endpoint and response",
  async (key) => {
    const config = createOpenAiCompatibleConfiguration({
      key,
      provider: "openai.chat",
      endpoint: "https://custom.example/{{region}}",
      apiKeyMapping: ["customApiKey", "UNUSED_TEST_API_KEY"],
      transformResponse: OutputDefault,
    });
    config.options.region = { default: "default-region" };
    config.options.customOption = {};
    config.mapBody.customOption = { key: "custom_field" };
    config.mapOptions = { jsonSchema: () => ({ custom_schema: true }) };
    request.mockResolvedValue({
      data: { text: "Custom response" },
      headers: {},
    });
    const llm = useLlmConfiguration(config)({
      model: "custom-model",
      region: "west",
      customOption: 42,
      customApiKey: "custom-key",
    });
    const result = await llm.call("Hi", { jsonSchema: {} });
    expect(request.mock.calls[0][0]).toBe("https://custom.example/west");
    expect(request.mock.calls[0][1]?.headers.Authorization).toBe(
      "Bearer custom-key",
    );
    expect(requestBody()).toEqual(
      expect.objectContaining({ custom_field: 42, custom_schema: true }),
    );
    expect(result.getResultText()).toBe("Custom response");
  },
);

it.each(["low", "high", "max"] as const)(
  "sends DeepSeek V4 effort %s",
  async (effort) => {
    await useLlm("deepseek.v4-pro", { effort }).call("Hi");
    expect(requestBody().reasoning_effort).toBe(effort);
  },
);

it("does not send effort for legacy DeepSeek models", async () => {
  await useLlm("deepseek.chat", {
    model: "deepseek-chat",
    effort: "high",
  }).call("Hi");
  expect(requestBody()).not.toHaveProperty("reasoning_effort");
});

it("keeps OpenAI schema output unchanged", async () => {
  await useLlm("openai.chat.v1", { model: "gpt-4o" }).call("Return JSON", {
    jsonSchema: { type: "object" },
  });
  expect(requestBody().response_format.type).toBe("json_schema");
});

it("uses DeepSeek JSON mode while preserving typed parser output and local validation", async () => {
  const executor = createLlmExecutor({
    llm: useLlm("deepseek.v4-flash"),
    prompt: createChatPrompt("Return JSON with a name string"),
    parser: createParser("json", {
      schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      } as const,
    }),
  });
  const result: { name: string } = await executor.execute({});
  expect(result).toEqual({ name: "Ada" });
  expect(requestBody().response_format).toEqual({ type: "json_object" });
  request.mockResolvedValue({
    data: { choices: [{ message: { content: '{"name":42}' } }] },
    headers: {},
  });
  await expect(executor.execute({})).rejects.toMatchObject({
    code: "parser.schema_validation_failed",
  });
});

it("signs the final body including extraBody for Bedrock", async () => {
  const signing = jest
    .spyOn(awsSigning, "getAwsAuthorizationHeaders")
    .mockResolvedValue({ Authorization: "test-signature" });
  try {
    await useLlm("amazon:anthropic.chat.v1", {
      model: "anthropic.claude-sonnet-4-5",
      awsRegion: "us-east-1",
      extraBody: { metadata: { user_id: "user-1" } },
    }).call("Hi");
    const body = request.mock.calls[0][1]?.body;
    expect(signing.mock.calls[0][0].body).toBe(body);
    expect(JSON.parse(body as string).metadata).toEqual({ user_id: "user-1" });
    expect(request.mock.calls[0][1]?.headers.Authorization).toBe(
      "test-signature",
    );
  } finally {
    signing.mockRestore();
  }
});
