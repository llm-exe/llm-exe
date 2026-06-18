import { anthropic } from "@/llm/config/anthropic";
import { mapBody } from "@/llm/_utils.mapBody";
import { anthropicPromptSanitize } from "./promptSanitize";

describe("anthropic config", () => {
  const config = anthropic["anthropic.chat.v1"];

  it("should have correct configuration properties", () => {
    expect(config).toEqual(
      expect.objectContaining({
        key: "anthropic.chat.v1",
        provider: "anthropic.chat",
        endpoint: "https://api.anthropic.com/v1/messages",
        headers: expect.any(String),
        method: "POST",
        options: expect.objectContaining({
          prompt: expect.any(Object),
          system: expect.any(Object),
          maxTokens: expect.any(Object),
          anthropicApiKey: expect.any(Object),
        }),
        mapBody: expect.objectContaining({
          model: expect.any(Object),
          maxTokens: expect.any(Object),
          system: expect.any(Object),
          prompt: expect.objectContaining({
            key: "messages",
            transform: anthropicPromptSanitize,
          }),
        }),
      })
    );
  });

  it("should have the correct header structure", () => {
    const headers = JSON.parse(config.headers);
    expect(headers).toEqual(
      expect.objectContaining({
        "x-api-key": "{{anthropicApiKey}}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      })
    );
  });

  it("should have correct options required properties", () => {
    expect(config.options.maxTokens.required).toEqual(
      expect.arrayContaining([true, "maxTokens required"])
    );
  });

  describe("deprecated shorthands still resolve", () => {
    it.each([
      ["anthropic.claude-opus-4-6", "claude-opus-4-6"],
      ["anthropic.claude-sonnet-4", "claude-sonnet-4-0"],
      ["anthropic.claude-opus-4", "claude-opus-4-0"],
      ["anthropic.claude-3-7-sonnet", "claude-3-7-sonnet-20250219"],
      ["anthropic.claude-3-5-sonnet", "claude-3-5-sonnet-latest"],
      ["anthropic.claude-3-5-haiku", "claude-3-5-haiku-latest"],
      ["anthropic.claude-3-opus", "claude-3-opus-20240229"],
    ] as const)(
      "%s should resolve to %s",
      (shorthand, expectedModel) => {
        const cfg = anthropic[shorthand];
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
      }
    );
  });

  describe("active shorthands", () => {
    it.each([
      ["anthropic.claude-fable-5", "claude-fable-5"],
      ["anthropic.claude-opus-4-8", "claude-opus-4-8"],
      ["anthropic.claude-opus-4-7", "claude-opus-4-7"],
      ["anthropic.claude-sonnet-4-6", "claude-sonnet-4-6"],
      ["anthropic.claude-opus-4-5", "claude-opus-4-5"],
      ["anthropic.claude-haiku-4-5", "claude-haiku-4-5"],
      ["anthropic.claude-sonnet-4-5", "claude-sonnet-4-5"],
      ["anthropic.claude-opus-4-1", "claude-opus-4-1-20250805"],
    ] as const)(
      "%s should resolve to %s",
      (shorthand, expectedModel) => {
        const cfg = anthropic[shorthand];
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
      }
    );
  });

  describe("sampling parameter guards", () => {
    const buildBody = (overrides: Record<string, any>) =>
      mapBody(config.mapBody, {
        maxTokens: 1024,
        prompt: [{ role: "user", content: "hi" }],
        ...overrides,
      });

    it("drops temperature, top_p, and top_k for claude-opus-4-7", () => {
      const body = buildBody({
        model: "claude-opus-4-7",
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
      });
      expect(body.temperature).toBeUndefined();
      expect(body.top_p).toBeUndefined();
      expect(body.top_k).toBeUndefined();
    });

    it("drops temperature, top_p, and top_k for claude-opus-4-8", () => {
      const body = buildBody({
        model: "claude-opus-4-8",
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
      });
      expect(body.temperature).toBeUndefined();
      expect(body.top_p).toBeUndefined();
      expect(body.top_k).toBeUndefined();
    });

    it("drops top_p but keeps temperature on Claude 4.x when both are set", () => {
      for (const model of [
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "claude-haiku-4-5",
        "claude-sonnet-4-5",
        "claude-opus-4-1-20250805",
        "claude-sonnet-4-0",
        "claude-opus-4-0",
      ]) {
        const body = buildBody({ model, temperature: 0.5, topP: 0.9 });
        expect(body.temperature).toBe(0.5);
        expect(body.top_p).toBeUndefined();
      }
    });

    it("keeps top_p on Claude 4.x when temperature is not set", () => {
      const body = buildBody({ model: "claude-sonnet-4-6", topP: 0.9 });
      expect(body.top_p).toBe(0.9);
    });

    it("keeps both temperature and top_p on Claude 3.x", () => {
      const body = buildBody({
        model: "claude-3-7-sonnet-20250219",
        temperature: 0.5,
        topP: 0.9,
      });
      expect(body.temperature).toBe(0.5);
      expect(body.top_p).toBe(0.9);
    });

    it("keeps top_k on Claude 4.x (non-Opus-4.7)", () => {
      const body = buildBody({
        model: "claude-sonnet-4-6",
        temperature: 0.5,
        topK: 40,
      });
      expect(body.top_k).toBe(40);
    });
  });

  describe("mapOptions.functionCall", () => {
    const functionCall = config.mapOptions!.functionCall!;

    it("returns _clearFunctions sentinel for 'none'", () => {
      expect(functionCall("none", {})).toEqual({ _clearFunctions: true });
    });

    it("wraps 'auto' as anthropic tool_choice object", () => {
      expect(functionCall("auto", {})).toEqual({
        tool_choice: { type: "auto" },
      });
    });

    it("wraps 'any' as anthropic tool_choice object", () => {
      expect(functionCall("any", {})).toEqual({
        tool_choice: { type: "any" },
      });
    });

    it("passes through specific function name unchanged", () => {
      expect(functionCall("my_func" as any, {})).toEqual({
        tool_choice: "my_func",
      });
    });
  });

  describe("mapOptions.functions", () => {
    const functions = config.mapOptions!.functions!;

    it("maps each function to anthropic's tools shape (name, description, input_schema)", () => {
      const result = functions(
        [
          {
            name: "lookup_weather",
            description: "Get weather for a city",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"],
            },
          },
        ],
        {}
      );

      expect(result).toEqual({
        tools: [
          {
            name: "lookup_weather",
            description: "Get weather for a city",
            input_schema: expect.objectContaining({
              type: "object",
              properties: { city: { type: "string" } },
            }),
          },
        ],
      });
      // Anthropic uses input_schema, not parameters — guard against regression
      expect(result.tools[0]).not.toHaveProperty("parameters");
      // Anthropic does NOT take a top-level `type: "function"` like OpenAI
      expect(result.tools[0]).not.toHaveProperty("type");
    });

    it("maps multiple functions in order", () => {
      const result = functions(
        [
          {
            name: "a",
            description: "first",
            parameters: { type: "object", properties: {} },
          },
          {
            name: "b",
            description: "second",
            parameters: { type: "object", properties: {} },
          },
        ],
        {}
      );
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe("a");
      expect(result.tools[1].name).toBe("b");
    });
  });
});
