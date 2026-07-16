import { configs, getLlmConfig } from "@/llm/config";
import { Config, LlmProviderKey } from "@/types";

// Capture env var defaults at import time (before beforeAll modifies them),
// since config objects are initialized when the module is first imported.
const AWS_REGION_AT_IMPORT = process.env.AWS_REGION;
const ANTHROPIC_API_KEY_AT_IMPORT = process.env.ANTHROPIC_API_KEY;

describe("configs", () => {
  const OLD_ENV = process.env;

  beforeAll(async () => {
    process.env.AWS_REGION = "us-west-2";
  });

  afterAll(async () => {
    process.env = OLD_ENV;
  });

  it("should have valid openai config", () => {
    const openaiConfig: Config = {
      key: "openai.chat.v1",
      provider: "openai.chat",
      endpoint: `https://api.openai.com/v1/chat/completions`,
      options: {
        prompt: {},
        effort: {},
        temperature: {},
        topP: {},
        maxTokens: {},
        stopSequences: {},
        frequencyPenalty: {},
        logitBias: {},
        useJson: {},
        openAiApiKey: {
          default: undefined,
        },
      },
      method: "POST",
      headers: `{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json" }`,
      mapBody: {
        prompt: {
          key: "messages",
          transform: expect.any(Function),
        },
        model: {
          key: "model",
        },
        temperature: {
          key: "temperature",
        },
        topP: {
          key: "top_p",
        },
        maxTokens: {
          key: "max_tokens",
        },
        stopSequences: {
          key: "stop",
        },
        frequencyPenalty: {
          key: "frequency_penalty",
        },
        logitBias: {
          key: "logit_bias",
        },
        useJson: {
          key: "response_format.type",
          transform: expect.any(Function),
        },
        effort: {
          key: "reasoning_effort",
          transform: expect.any(Function),
        },
      },
      mapOptions: {
        functionCall: expect.any(Function),
        functions: expect.any(Function),
        jsonSchema: expect.any(Function),
      },
      transformResponse: expect.any(Function),
    };
    expect(configs["openai.chat.v1"]).toEqual(openaiConfig);
  });

  it("should have valid anthropic config", () => {
    const anthropicConfig: Config = {
      key: "anthropic.chat.v1",
      provider: "anthropic.chat",
      endpoint: `https://api.anthropic.com/v1/messages`,
      headers: `{"x-api-key":"{{anthropicApiKey}}", "Content-Type": "application/json", "anthropic-version": "2023-06-01" }`,
      method: "POST",
      options: {
        prompt: {},
        system: {},
        maxTokens: {
          default: 4096,
          required: [true, "maxTokens required"],
        },
        temperature: {},
        topP: {},
        topK: {},
        stopSequences: {},
        metadata: {},
        serviceTier: {},
        anthropicApiKey: {
          default: ANTHROPIC_API_KEY_AT_IMPORT,
        },
      },
      mapBody: {
        model: {
          key: "model",
        },
        maxTokens: {
          key: "max_tokens",
        },
        prompt: {
          key: "messages",
          transform: expect.any(Function),
        },
        system: {
          key: "system",
        },
        temperature: {
          key: "temperature",
          transform: expect.any(Function),
        },
        topP: {
          key: "top_p",
          transform: expect.any(Function),
        },
        topK: {
          key: "top_k",
          transform: expect.any(Function),
        },
        stopSequences: {
          key: "stop_sequences",
        },
        metadata: {
          key: "metadata",
        },
        serviceTier: {
          key: "service_tier",
        },
      },
      mapOptions: {
        functionCall: expect.any(Function),
        functions: expect.any(Function),
      },
      transformResponse: expect.any(Function),
    };
    expect(configs["anthropic.chat.v1"]).toEqual(anthropicConfig);
  });

  it("should have valid amazon:anthropic.chat.v1 config", () => {
    const amazonAnthropicConfig: Config = {
      key: "amazon:anthropic.chat.v1",
      provider: "amazon:anthropic.chat",
      method: "POST",
      headers: `{"Content-Type": "application/json" }`,
      endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
      options: {
        prompt: {},
        topP: {},
        maxTokens: {},
        awsRegion: {
          default: AWS_REGION_AT_IMPORT,
          required: [true, "aws region is required"],
        },
        awsSecretKey: {},
        awsAccessKey: {},
      },
      mapBody: {
        prompt: {
          key: "messages",
          transform: expect.any(Function),
        },
        topP: {
          key: "top_p",
        },
        maxTokens: {
          key: "max_tokens",
          default: 10000,
        },
        anthropic_version: {
          key: "anthropic_version",
          default: "bedrock-2023-05-31",
        },
      },
      mapOptions: {
        functionCall: expect.any(Function),
        functions: expect.any(Function),
      },
      transformResponse: expect.any(Function),
    };
    expect(configs["amazon:anthropic.chat.v1"]).toEqual(amazonAnthropicConfig);
  });

  it("should have valid amazon:meta.chat.v1 config", () => {
    const amazonMetaConfig: Config = {
      key: "amazon:meta.chat.v1",
      provider: "amazon:meta.chat",
      method: "POST",
      headers: `{"Content-Type": "application/json" }`,
      options: {
        prompt: {},
        topP: {},
        maxTokens: {},
        temperature: {},
        awsRegion: {
          default: AWS_REGION_AT_IMPORT,
        },
        awsSecretKey: {},
        awsAccessKey: {},
      },
      endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
      mapBody: {
        prompt: {
          key: "prompt",
          transform: expect.any(Function),
        },
        topP: {
          key: "top_p",
        },
        temperature: {
          key: "temperature",
        },
        maxTokens: {
          key: "max_gen_len",
          default: 2048,
        },
      },
      transformResponse: expect.any(Function),
    };
    expect(configs["amazon:meta.chat.v1"]).toEqual(amazonMetaConfig);
  });

  it("should have valid amazon:meta.chat.v1 transform prompt", () => {
    const config = configs["amazon:meta.chat.v1"];
    const transform = config.mapBody["prompt"].transform!;
    expect(typeof transform).toEqual("function");

    const transformed = transform(
      [{ role: "assistant", content: "Hello World" }],
      {},
      {}
    );
    expect(transformed.trim()).toEqual(`Assistant: Hello World`);
  });
});

describe("getLlmConfig", () => {
  it("should return the correct config for a valid provider", () => {
    const key: LlmProviderKey = "openai.chat.v1";
    const config: Config = getLlmConfig(key);
    expect(config).toEqual(configs[key]);
  });

  it("should throw an error for an invalid provider", () => {
    const provider: any = "invalid";
    expect(() => getLlmConfig(provider)).toThrow(
      `Invalid provider: ${provider}`
    );
  });

  it("should throw an error when provider is undefined", () => {
    const provider: any = undefined;
    expect(() => getLlmConfig(provider)).toThrow(`Missing provider`);
  });

  it("should throw an error when provider is empty string", () => {
    const provider: any = "";
    expect(() => getLlmConfig(provider)).toThrow(`Missing provider`);
  });

  it("should throw an error when provider is null", () => {
    const provider: any = null;
    expect(() => getLlmConfig(provider)).toThrow(`Missing provider`);
  });

  it("should return the correct config for 'amazon:meta.chat.v1'", () => {
    const key: LlmProviderKey = "amazon:meta.chat.v1";
    const config: Config = getLlmConfig(key);
    expect(config).toEqual(configs[key]);
  });

  it("should return the correct config for 'amazon:anthropic.chat.v1'", () => {
    const key: LlmProviderKey = "amazon:anthropic.chat.v1";
    const config: Config = getLlmConfig(key);
    expect(config).toEqual(configs[key]);
  });

  it("should have all required fields for 'openai' config", () => {
    const config: Config = getLlmConfig("openai.chat.v1");
    const keys = [
      "provider",
      "endpoint",
      "options",
      "method",
      "headers",
      "mapBody",
    ];
    keys.forEach((key) => {
      expect(config).toHaveProperty(key);
    });
  });

  it("should have all required fields for 'anthropic' config", () => {
    const config: Config = getLlmConfig("anthropic.chat.v1");
    const keys = [
      "provider",
      "endpoint",
      "options",
      "method",
      "headers",
      "mapBody",
    ];
    keys.forEach((key) => {
      expect(config).toHaveProperty(key);
    });
  });

  it("should have all required fields for 'amazon:anthropic.chat.v1' config", () => {
    const config: Config = getLlmConfig("amazon:anthropic.chat.v1");
    const keys = [
      "provider",
      "endpoint",
      "options",
      "method",
      "headers",
      "mapBody",
    ];
    keys.forEach((key) => {
      expect(config).toHaveProperty(key);
    });
  });

  it("should have all required fields for 'amazon:meta.chat.v1' config", () => {
    const config: Config = getLlmConfig("amazon:meta.chat.v1");
    const keys = [
      "provider",
      "endpoint",
      "options",
      "method",
      "headers",
      "mapBody",
    ];
    keys.forEach((key) => {
      expect(config).toHaveProperty(key);
    });
  });
});
