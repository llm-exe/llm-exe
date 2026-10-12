import { configs } from "@/llm/config";
import { mapBody } from "@/llm/_utils.mapBody";
import { Config } from "@/types";

/**
 * Cross-provider prompt contract.
 *
 * llm-exe's core promise is that application code writes ONE message shape and
 * every provider receives its own native request body. This file is the table
 * that states, for every provider registered in `configs`, what each canonical
 * llm-exe message turns into on the wire.
 *
 * Two things make this a contract rather than a restatement of the per-provider
 * unit tests:
 *
 * 1. It is driven by the provider registry. `configs` is the source of truth —
 *    a new provider (or a renamed one) fails `PROVIDER_CONTRACTS` coverage until
 *    someone writes down what it does with these messages.
 * 2. It runs the real `mapBody` path, not the sanitize callbacks in isolation,
 *    so provider wiring is covered too: the body key (`messages` / `contents` /
 *    `prompt`), Bedrock's `allowImageUrlSources: false`, system hoisting to
 *    `system` / `system_instruction`, and consecutive-role merging.
 */

const PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUg==";
const REMOTE_IMAGE_URL = "https://example.com/cat.png";

interface Fixture {
  name: string;
  /** a factory, so each provider/assertion gets its own unmutated copy */
  messages: () => Record<string, any>[];
}

const FIXTURES: Fixture[] = [
  {
    name: "plain text user message",
    messages: () => [{ role: "user", content: "Hello" }],
  },
  {
    name: "leading system message",
    messages: () => [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ],
  },
  {
    name: "assistant turn",
    messages: () => [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Sure thing" },
    ],
  },
  {
    name: "base64 image content block",
    messages: () => [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image_url", image_url: { url: PNG_DATA_URI } },
        ],
      },
    ],
  },
  {
    name: "remote https image content block",
    messages: () => [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: REMOTE_IMAGE_URL } },
        ],
      },
    ],
  },
  {
    name: "assistant tool call",
    messages: () => [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: null,
        function_call: {
          id: "call_1",
          name: "get_weather",
          arguments: '{"city":"Denver"}',
        },
      },
    ],
  },
  {
    name: "tool result",
    messages: () => [
      { role: "user", content: "weather?" },
      {
        role: "function",
        id: "call_1",
        name: "get_weather",
        content: "72 and sunny",
      },
    ],
  },
  {
    name: "image tool result",
    messages: () => [
      { role: "user", content: "what does the camera see?" },
      {
        role: "function",
        id: "call_1",
        name: "get_snapshot",
        content: [
          { type: "text", text: "here is the snapshot" },
          { type: "image_url", image_url: { url: PNG_DATA_URI } },
        ],
      },
    ],
  },
];

/** what one fixture becomes for one provider */
type Expectation =
  | { throws: string }
  | {
      prompt: any;
      /** system content lifted out of the messages array, if the provider does that */
      hoisted?: Record<string, any>;
    };

interface ProviderContract {
  /** the request body key the messages land on */
  bodyKey: string;
  expectations: Record<string, Expectation>;
}

const openaiExpectations: Record<string, Expectation> = {
  "plain text user message": { prompt: [{ role: "user", content: "Hello" }] },
  "leading system message": {
    // openai keeps the system message inline
    prompt: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ],
  },
  "assistant turn": {
    prompt: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Sure thing" },
    ],
  },
  "base64 image content block": {
    prompt: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image_url", image_url: { url: PNG_DATA_URI } },
        ],
      },
    ],
  },
  "remote https image content block": {
    prompt: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: REMOTE_IMAGE_URL } },
        ],
      },
    ],
  },
  "assistant tool call": {
    prompt: [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"city":"Denver"}',
            },
          },
        ],
      },
    ],
  },
  "tool result": {
    prompt: [
      { role: "user", content: "weather?" },
      {
        role: "tool",
        name: "get_weather",
        content: "72 and sunny",
        tool_call_id: "call_1",
      },
    ],
  },
  // Chat Completions `tool` messages are text-only
  "image tool result": {
    throws: "Image content is not supported in tool results by this provider",
  },
};

function anthropicExpectations(options: {
  allowImageUrlSources: boolean;
}): Record<string, Expectation> {
  return {
    "plain text user message": { prompt: [{ role: "user", content: "Hello" }] },
    "leading system message": {
      // anthropic lifts the system message onto the body
      prompt: [{ role: "user", content: "Hello" }],
      hoisted: { system: "You are helpful" },
    },
    "assistant turn": {
      prompt: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Sure thing" },
      ],
    },
    "base64 image content block": {
      prompt: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: PNG_BASE64,
              },
            },
          ],
        },
      ],
    },
    "remote https image content block": options.allowImageUrlSources
      ? {
          prompt: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "url", url: REMOTE_IMAGE_URL },
                },
              ],
            },
          ],
        }
      : // bedrock's invoke API cannot fetch remote images
        { throws: "Image URLs are not supported by this provider" },
    "assistant tool call": {
      prompt: [
        { role: "user", content: "weather?" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "call_1",
              name: "get_weather",
              input: { city: "Denver" },
            },
          ],
        },
      ],
    },
    "tool result": {
      prompt: [
        { role: "user", content: "weather?" },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "call_1",
              content: "72 and sunny",
            },
          ],
        },
      ],
    },
    // anthropic is the one provider that takes images natively inside a
    // tool_result, so the blocks stay blocks
    "image tool result": {
      prompt: [
        { role: "user", content: "what does the camera see?" },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "call_1",
              content: [
                { type: "text", text: "here is the snapshot" },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: PNG_BASE64,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

const googleExpectations: Record<string, Expectation> = {
  "plain text user message": {
    prompt: [{ role: "user", parts: [{ text: "Hello" }] }],
  },
  "leading system message": {
    // gemini lifts the system message onto system_instruction
    prompt: [{ role: "user", parts: [{ text: "Hello" }] }],
    hoisted: {
      system_instruction: { parts: [{ text: "You are helpful" }] },
    },
  },
  "assistant turn": {
    prompt: [
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Sure thing" }] },
    ],
  },
  "base64 image content block": {
    prompt: [
      {
        role: "user",
        parts: [
          { text: "What is this?" },
          { inlineData: { mimeType: "image/png", data: PNG_BASE64 } },
        ],
      },
    ],
  },
  "remote https image content block": {
    throws: "Gemini cannot load images from arbitrary URLs",
  },
  "assistant tool call": {
    prompt: [
      { role: "user", parts: [{ text: "weather?" }] },
      {
        role: "model",
        parts: [
          { functionCall: { name: "get_weather", args: { city: "Denver" } } },
        ],
      },
    ],
  },
  "tool result": {
    // the functionResponse merges into the preceding user turn
    prompt: [
      {
        role: "user",
        parts: [
          { text: "weather?" },
          {
            functionResponse: {
              name: "get_weather",
              response: { result: "72 and sunny" },
            },
          },
        ],
      },
    ],
  },
  // functionResponse.response is a text-only Struct, so the image rides
  // alongside it as an inlineData FunctionResponsePart
  "image tool result": {
    prompt: [
      {
        role: "user",
        parts: [
          { text: "what does the camera see?" },
          {
            functionResponse: {
              name: "get_snapshot",
              response: { result: "here is the snapshot" },
              parts: [
                { inlineData: { mimeType: "image/png", data: PNG_BASE64 } },
              ],
            },
          },
        ],
      },
    ],
  },
};

const ollamaExpectations: Record<string, Expectation> = {
  "plain text user message": { prompt: [{ role: "user", content: "Hello" }] },
  "leading system message": {
    prompt: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ],
  },
  "assistant turn": {
    prompt: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Sure thing" },
    ],
  },
  "base64 image content block": {
    // ollama splits array content into a text string plus raw base64 images
    prompt: [
      {
        role: "user",
        content: "What is this?",
        images: [PNG_BASE64],
      },
    ],
  },
  "remote https image content block": {
    throws: "Image URLs are not supported by ollama",
  },
  // `ollamaPromptSanitize` returns early for any message whose content is not an
  // array, so the llm-exe tool shape (`function_call`, `role: "function"`) goes
  // out on the wire unconverted. Ollama's /api/chat actually expects
  // `tool_calls: [{ function: { name, arguments } }]` and `role: "tool"`, so the
  // two rows below record current behavior — they are not a provider capability
  // and not a guarantee. Tracked in #706.
  "assistant tool call": {
    prompt: [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: null,
        function_call: {
          id: "call_1",
          name: "get_weather",
          arguments: '{"city":"Denver"}',
        },
      },
    ],
  },
  "tool result": {
    prompt: [
      { role: "user", content: "weather?" },
      {
        role: "function",
        id: "call_1",
        name: "get_weather",
        content: "72 and sunny",
      },
    ],
  },
  // `ollamaPromptSanitize` is role-agnostic, so a tool result with array
  // content splits into text + `images` like any other message. Whether
  // ollama honors `images` on a tool-role message is the open part of #706.
  "image tool result": {
    prompt: [
      { role: "user", content: "what does the camera see?" },
      {
        role: "function",
        id: "call_1",
        name: "get_snapshot",
        content: "here is the snapshot",
        images: [PNG_BASE64],
      },
    ],
  },
};

/**
 * Bedrock's Llama models take a single flattened text prompt, so the message
 * array is rendered through the DialogueHistory partial. Tool metadata has no
 * representation in that format and is dropped — recorded here as current
 * behavior, not as a guarantee we want to keep.
 */
const metaExpectations: Record<string, Expectation> = {
  "plain text user message": { prompt: "\nUser: Hello\n" },
  "leading system message": {
    prompt: "\nSystem: You are helpful\nUser: Hello\n",
  },
  "assistant turn": { prompt: "\nUser: Hi\nAssistant: Sure thing\n" },
  "base64 image content block": { throws: "Image content is not supported" },
  "remote https image content block": {
    throws: "Image content is not supported",
  },
  "assistant tool call": { prompt: "\nUser: weather?\nAssistant: \n" },
  "tool result": { prompt: "\nUser: weather?\n" },
  "image tool result": { throws: "Image content is not supported" },
};

/** the mock provider has no prompt transform — messages pass through verbatim */
const passthroughExpectations: Record<string, Expectation> =
  Object.fromEntries(
    FIXTURES.map((fixture) => [fixture.name, { prompt: fixture.messages() }])
  );

/**
 * Every provider in `configs` needs a row here. Adding a provider — or pointing
 * an existing one at a different sanitizer — fails until this table says what
 * the new behavior is.
 */
const PROVIDER_CONTRACTS: Record<string, ProviderContract> = {
  "openai.chat": { bodyKey: "messages", expectations: openaiExpectations },
  "openai.chat-mock": {
    bodyKey: "messages",
    expectations: passthroughExpectations,
  },
  "xai.chat": { bodyKey: "messages", expectations: openaiExpectations },
  "deepseek.chat": { bodyKey: "messages", expectations: openaiExpectations },
  "anthropic.chat": {
    bodyKey: "messages",
    expectations: anthropicExpectations({ allowImageUrlSources: true }),
  },
  "amazon:anthropic.chat": {
    bodyKey: "messages",
    expectations: anthropicExpectations({ allowImageUrlSources: false }),
  },
  "amazon:meta.chat": { bodyKey: "prompt", expectations: metaExpectations },
  "google.chat": { bodyKey: "contents", expectations: googleExpectations },
  "ollama.chat": { bodyKey: "messages", expectations: ollamaExpectations },
};

/**
 * Body keys a provider may lift system content onto. This list has to grow when
 * a provider hoists to a key that isn't here — otherwise `hoistedFrom` returns
 * `{}` and that provider silently passes with `hoisted: {}`.
 */
const HOISTED_KEYS = ["system", "system_instruction"];

const CONFIG_KEYS_BY_PROVIDER = Object.entries(configs).reduce(
  (acc, [key, config]) => {
    const provider = (config as Config).provider;
    acc[provider] = [...(acc[provider] || []), key];
    return acc;
  },
  {} as Record<string, string[]>
);

function buildBody(config: Config, messages: any) {
  return mapBody(config.mapBody, { prompt: messages, model: "test-model" });
}

function hoistedFrom(body: Record<string, any>) {
  return HOISTED_KEYS.reduce(
    (acc, key) => (key in body ? { ...acc, [key]: body[key] } : acc),
    {} as Record<string, any>
  );
}

describe("cross-provider prompt contract", () => {
  it("covers every provider registered in configs", () => {
    expect(Object.keys(CONFIG_KEYS_BY_PROVIDER).sort()).toEqual(
      Object.keys(PROVIDER_CONTRACTS).sort()
    );
  });

  describe.each(Object.entries(PROVIDER_CONTRACTS))(
    "%s",
    (provider, contract) => {
      const configKeys = CONFIG_KEYS_BY_PROVIDER[provider] || [];

      it(`maps the prompt onto "${contract.bodyKey}"`, () => {
        for (const key of configKeys) {
          const config = configs[key as keyof typeof configs] as Config;
          expect({ key, promptKey: config.mapBody.prompt?.key }).toEqual({
            key,
            promptKey: contract.bodyKey,
          });
        }
      });

      describe.each(FIXTURES)("$name", (fixture) => {
        const expectation = contract.expectations[fixture.name];

        it("has a recorded expectation", () => {
          // adding a fixture without filling in every provider table should say
          // which table is incomplete, not blow up inside the assertions below
          expect(expectation).toBeDefined();
        });

        it("produces the provider-native shape", () => {
          // every shorthand of a provider must agree — a shorthand rewired to a
          // different sanitizer fails here with its own key in the diff
          for (const key of configKeys) {
            const config = configs[key as keyof typeof configs] as Config;

            if ("throws" in expectation) {
              expect(() => buildBody(config, fixture.messages())).toThrow(
                expectation.throws
              );
              continue;
            }

            const body = buildBody(config, fixture.messages());
            expect({ key, prompt: body[contract.bodyKey] }).toEqual({
              key,
              prompt: expectation.prompt,
            });
            expect({ key, hoisted: hoistedFrom(body) }).toEqual({
              key,
              hoisted: expectation.hoisted || {},
            });
          }
        });

        it("does not mutate the caller's messages", () => {
          // unlike the shape assertion above, this checks one config key rather
          // than every shorthand — all shorthands of a provider share the same
          // sanitizer, so the copying behavior is identical across them
          const config = configs[
            configKeys[0] as keyof typeof configs
          ] as Config;
          const messages = fixture.messages();
          const before = JSON.parse(JSON.stringify(messages));

          try {
            buildBody(config, messages);
          } catch (e) {
            // the throwing fixtures still must not leave the caller's messages
            // half-transformed
          }

          expect(messages).toEqual(before);
        });
      });
    }
  );
});
