import { createOpenAiCompatibleConfiguration } from "./compatible";
import { mapBody } from "@/llm/_utils.mapBody";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";

jest.mock("@/utils/modules/getEnvironmentVariable");

describe("createOpenAiCompatibleConfiguration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEnvironmentVariable as jest.Mock).mockReturnValue("test-api-key");
  });

  it("should create a config with correct key, provider, endpoint, and method", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(config.key).toBe("custom.chat.v1");
    expect(config.provider).toBe("custom.chat");
    expect(config.endpoint).toBe("https://api.custom.com/v1/chat");
    expect(config.method).toBe("POST");
  });

  it("should set headers with the api key property name", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(config.headers).toContain("{{customApiKey}}");
    expect(config.headers).toContain("Content-Type");
  });

  it("should read the api key from the environment variable", () => {
    createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(getEnvironmentVariable).toHaveBeenCalledWith("CUSTOM_API_KEY");
  });

  it("should set the api key default from the environment variable", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(config.options.customApiKey).toEqual({ default: "test-api-key" });
  });

  it("should have correct mapBody keys", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(config.mapBody.prompt.key).toBe("messages");
    expect(config.mapBody.model.key).toBe("model");
    expect(config.mapBody.temperature.key).toBe("temperature");
    expect(config.mapBody.topP.key).toBe("top_p");
    expect(config.mapBody.maxTokens.key).toBe("max_tokens");
    expect(config.mapBody.stopSequences.key).toBe("stop");
    expect(config.mapBody.frequencyPenalty.key).toBe("frequency_penalty");
    expect(config.mapBody.logitBias.key).toBe("logit_bias");
    expect(config.mapBody.useJson.key).toBe("response_format.type");
  });

  it("should transform useJson correctly", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    const transform = config.mapBody.useJson.transform as (v: any) => any;
    expect(transform(true)).toBe("json_object");
    expect(transform(false)).toBe("text");
  });

  it("should use custom transformResponse when provided", () => {
    const customTransform = jest.fn();
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
      transformResponse: customTransform,
    });

    expect(config.transformResponse).toBe(customTransform);
  });

  it("should use default OutputOpenAIChat transformResponse when not provided", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(typeof config.transformResponse).toBe("function");
  });

  it("should have standard option keys", () => {
    const config = createOpenAiCompatibleConfiguration({
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
    });

    expect(config.options).toHaveProperty("prompt");
    expect(config.options).toHaveProperty("effort");
    expect(config.options).toHaveProperty("temperature");
    expect(config.options).toHaveProperty("topP");
    expect(config.options).toHaveProperty("maxTokens");
    expect(config.options).toHaveProperty("stopSequences");
    expect(config.options).toHaveProperty("frequencyPenalty");
    expect(config.options).toHaveProperty("logitBias");
    expect(config.options).toHaveProperty("useJson");
  });

  describe("effort transform", () => {
    const baseOverrides = {
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"] as [string, string],
    };

    it("forwards effort when the supplied predicate matches", () => {
      const config = createOpenAiCompatibleConfiguration({
        ...baseOverrides,
        isReasoningModel: (m) =>
          m.startsWith("gpt-5") || m.startsWith("o3") || m.startsWith("o4"),
      });

      const transform = config.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      expect(transform("low", { model: "gpt-5.2" })).toBe("low");
      expect(transform("medium", { model: "gpt-5-mini" })).toBe("medium");
      expect(transform("high", { model: "gpt-5-nano" })).toBe("high");
      expect(transform("minimal", { model: "gpt-5.2" })).toBe("minimal");
      expect(transform("low", { model: "o3" })).toBe("low");
      expect(transform("high", { model: "o4-mini" })).toBe("high");
    });

    it("drops effort when the predicate rejects the model", () => {
      const config = createOpenAiCompatibleConfiguration({
        ...baseOverrides,
        isReasoningModel: (m) =>
          m.startsWith("gpt-5") || m.startsWith("o3") || m.startsWith("o4"),
      });

      const transform = config.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      expect(transform("high", { model: "gpt-4o" })).toBeUndefined();
      expect(transform("high", { model: "gpt-4.1" })).toBeUndefined();
      expect(transform("high", { model: "gpt-4.1-mini" })).toBeUndefined();
    });

    it("drops effort for every model when no predicate is supplied", () => {
      const config = createOpenAiCompatibleConfiguration(baseOverrides);

      const transform = config.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      expect(transform("high", { model: "gpt-5.2" })).toBeUndefined();
      expect(transform("low", { model: "o3" })).toBeUndefined();
    });

    it("returns undefined for invalid effort values", () => {
      const config = createOpenAiCompatibleConfiguration({
        ...baseOverrides,
        isReasoningModel: () => true,
      });

      const transform = config.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      expect(transform("invalid", { model: "gpt-5.2" })).toBeUndefined();
      expect(transform(123, { model: "o3" })).toBeUndefined();
    });

    it("returns undefined when model is not a string", () => {
      const config = createOpenAiCompatibleConfiguration({
        ...baseOverrides,
        isReasoningModel: () => true,
      });

      const transform = config.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      expect(transform("high", { model: undefined })).toBeUndefined();
    });
  });

  // Reasoning-model request rules are opt-in per provider: OpenAI's gpt-5 /
  // o-series reject `max_tokens` and non-default sampling params, but xAI and
  // Deepseek reasoning models still accept them, so the factory default must
  // leave every body unchanged.
  describe("reasoning-model request rules", () => {
    const baseOverrides = {
      key: "custom.chat.v1",
      provider: "custom.chat",
      endpoint: "https://api.custom.com/v1/chat",
      apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"] as [string, string],
      isReasoningModel: (m: string) => m.startsWith("reasoner"),
    };

    const build = (config: ReturnType<typeof createOpenAiCompatibleConfiguration>, state: Record<string, any>) =>
      mapBody(config.mapBody, { prompt: [{ role: "user", content: "hi" }], ...state });

    describe("defaults (no rule overrides)", () => {
      const config = createOpenAiCompatibleConfiguration(baseOverrides);

      it("forwards temperature, top_p, and max_tokens unchanged for reasoning models", () => {
        const body = build(config, {
          model: "reasoner-1",
          temperature: 0,
          topP: 0.9,
          maxTokens: 256,
          effort: "high",
        });
        expect(body.temperature).toBe(0);
        expect(body.top_p).toBe(0.9);
        expect(body.max_tokens).toBe(256);
        expect(body.max_completion_tokens).toBeUndefined();
        expect(body.reasoning_effort).toBe("high");
      });

      it("forwards them unchanged for non-reasoning models", () => {
        const body = build(config, {
          model: "chat-1",
          temperature: 0,
          topP: 0.9,
          maxTokens: 256,
        });
        expect(body.temperature).toBe(0);
        expect(body.top_p).toBe(0.9);
        expect(body.max_tokens).toBe(256);
      });
    });

    describe("reasoningMaxTokensKey", () => {
      const config = createOpenAiCompatibleConfiguration({
        ...baseOverrides,
        reasoningMaxTokensKey: "max_completion_tokens",
      });

      it("redirects maxTokens to the reasoning key for reasoning models", () => {
        const body = build(config, { model: "reasoner-1", maxTokens: 256 });
        expect(body.max_completion_tokens).toBe(256);
        expect(body.max_tokens).toBeUndefined();
      });

      it("keeps max_tokens for non-reasoning models", () => {
        const body = build(config, { model: "chat-1", maxTokens: 256 });
        expect(body.max_tokens).toBe(256);
        expect(body.max_completion_tokens).toBeUndefined();
      });

      it("sends neither key when maxTokens is unset", () => {
        const body = build(config, { model: "reasoner-1" });
        expect(body.max_tokens).toBeUndefined();
        expect(body.max_completion_tokens).toBeUndefined();
        expect("max_completion_tokens" in body).toBe(false);
      });

      it("leaves sampling params alone (rules are independent)", () => {
        const body = build(config, {
          model: "reasoner-1",
          temperature: 0,
          topP: 0.9,
        });
        expect(body.temperature).toBe(0);
        expect(body.top_p).toBe(0.9);
      });
    });

    describe("reasoningSamplingAllowedEfforts", () => {
      const config = createOpenAiCompatibleConfiguration({
        ...baseOverrides,
        reasoningEfforts: ["none", "low", "high"],
        reasoningSamplingAllowedEfforts: ["none"],
      });

      it("drops temperature and top_p for reasoning models when effort is unset", () => {
        const body = build(config, {
          model: "reasoner-1",
          temperature: 0,
          topP: 0.9,
        });
        expect(body.temperature).toBeUndefined();
        expect(body.top_p).toBeUndefined();
        expect("temperature" in body).toBe(false);
      });

      it("drops them when effort is set to a value outside the allowed list", () => {
        for (const effort of ["low", "high"]) {
          const body = build(config, {
            model: "reasoner-1",
            temperature: 0.2,
            topP: 0.9,
            effort,
          });
          expect(body.temperature).toBeUndefined();
          expect(body.top_p).toBeUndefined();
          expect(body.reasoning_effort).toBe(effort);
        }
      });

      it("keeps them when effort is in the allowed list", () => {
        const body = build(config, {
          model: "reasoner-1",
          temperature: 0,
          topP: 0.9,
          effort: "none",
        });
        expect(body.temperature).toBe(0);
        expect(body.top_p).toBe(0.9);
        expect(body.reasoning_effort).toBe("none");
      });

      it("does not treat an invalid effort as allowed, even if it is in the allowed list", () => {
        const permissive = createOpenAiCompatibleConfiguration({
          ...baseOverrides,
          reasoningEfforts: ["low", "high"],
          reasoningSamplingAllowedEfforts: ["none"],
        });
        // "none" is not a valid effort for this provider, so it is neither
        // sent as reasoning_effort nor allowed to unlock sampling params.
        const body = build(permissive, {
          model: "reasoner-1",
          temperature: 0,
          effort: "none",
        });
        expect(body.reasoning_effort).toBeUndefined();
        expect(body.temperature).toBeUndefined();
      });

      it("keeps sampling params for non-reasoning models regardless of effort", () => {
        const body = build(config, {
          model: "chat-1",
          temperature: 0,
          topP: 0.9,
          effort: "high",
        });
        expect(body.temperature).toBe(0);
        expect(body.top_p).toBe(0.9);
        expect(body.reasoning_effort).toBeUndefined();
      });

      it("tolerates a missing model (fail-open, nothing to gate on)", () => {
        const body = build(config, { temperature: 0.3, topP: 0.8, maxTokens: 10 });
        expect(body.temperature).toBe(0.3);
        expect(body.top_p).toBe(0.8);
        expect(body.max_tokens).toBe(10);
      });
    });
  });

  describe("mapOptions", () => {
    it("replaces only the overridden mappings when mapOptions is provided", () => {
      const jsonSchema = jest.fn(() => ({
        response_format: { type: "json_object" },
      }));
      const config = createOpenAiCompatibleConfiguration({
        key: "custom.chat.v1",
        provider: "custom.chat",
        endpoint: "https://api.custom.com/v1/chat/completions",
        apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
        mapOptions: { jsonSchema },
      });

      expect(config.mapOptions?.jsonSchema?.({}, {})).toEqual({
        response_format: { type: "json_object" },
      });
      expect(jsonSchema).toHaveBeenCalledTimes(1);
      expect(config.mapOptions?.functionCall?.("any")).toEqual({
        tool_choice: "required",
      });
      expect(
        config.mapOptions?.functions?.([{ name: "lookup", description: "d" }], {})
      ).toEqual({
        tools: [
          expect.objectContaining({
            type: "function",
            function: expect.objectContaining({ name: "lookup" }),
          }),
        ],
      });
    });

    it("should map functionCall options correctly", () => {
      const config = createOpenAiCompatibleConfiguration({
        key: "custom.chat.v1",
        provider: "custom.chat",
        endpoint: "https://api.custom.com/v1/chat",
        apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
      });

      const functionCall = config.mapOptions!.functionCall!;
      expect(functionCall("any")).toEqual({ tool_choice: "required" });
      expect(functionCall("none")).toEqual({ tool_choice: "none" });
      expect(functionCall("auto")).toEqual({ tool_choice: "auto" });
      expect(functionCall("myFunction")).toEqual({
        tool_choice: "myFunction",
      });
    });

    it("should map functions to tools format", () => {
      const config = createOpenAiCompatibleConfiguration({
        key: "custom.chat.v1",
        provider: "custom.chat",
        endpoint: "https://api.custom.com/v1/chat",
        apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
      });

      const functions = config.mapOptions!.functions!;
      const result = functions(
        [
          {
            name: "testFn",
            description: "A test function",
            parameters: { type: "object", properties: {} },
          },
        ],
        {}
      );

      expect(result).toEqual({
        tools: [
          {
            type: "function",
            function: {
              name: "testFn",
              description: "A test function",
              parameters: expect.any(Object),
              strict: false,
            },
          },
        ],
      });
    });

    it("should set strict to true when functionCallStrictInput is set", () => {
      const config = createOpenAiCompatibleConfiguration({
        key: "custom.chat.v1",
        provider: "custom.chat",
        endpoint: "https://api.custom.com/v1/chat",
        apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
      });

      const functions = config.mapOptions!.functions!;
      const result = functions(
        [
          {
            name: "testFn",
            description: "A test function",
            parameters: { type: "object", properties: {} },
          },
        ],
        { functionCallStrictInput: true }
      );

      expect(result.tools[0].function.strict).toBe(true);
    });

    it("should map jsonSchema option correctly", () => {
      const config = createOpenAiCompatibleConfiguration({
        key: "custom.chat.v1",
        provider: "custom.chat",
        endpoint: "https://api.custom.com/v1/chat",
        apiKeyMapping: ["customApiKey", "CUSTOM_API_KEY"],
      });

      const jsonSchema = config.mapOptions!.jsonSchema!;
      const result = jsonSchema(
        { type: "object", properties: { name: { type: "string" } } },
        {},
        {}
      );

      expect(result).toEqual({
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: expect.any(Object),
          },
        },
      });
    });
  });
});
