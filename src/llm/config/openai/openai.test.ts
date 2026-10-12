import { openai } from "@/llm/config/openai";
import { mapBody } from "@/llm/_utils.mapBody";
import { useLlm } from "@/llm";
import { Config, UseLlmKey } from "@/types";

describe("openai configuration", () => {
  const openAiChatV1 = openai["openai.chat.v1"] as Config;
  const openAiChatMockV1 = openai["openai.chat-mock.v1"] as Config;
  const openAiGpt4o = openai["openai.gpt-4o"] as Config;

  describe("openai.chat.v1", () => {
    it("should have the correct key, provider, endpoint, and method", () => {
      expect(openAiChatV1.key).toBe("openai.chat.v1");
      expect(openAiChatV1.provider).toBe("openai.chat");
      expect(openAiChatV1.endpoint).toBe(
        "https://api.openai.com/v1/chat/completions"
      );
      expect(openAiChatV1.method).toBe("POST");
    });

    it("should have correct headers", () => {
      expect(openAiChatV1.headers).toBe(
        `{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json" }`
      );
    });

    it("should transform the prompt correctly", () => {
      const transformPrompt = openAiChatV1.mapBody.prompt.transform as (
        v: any
      ) => any;
      expect(transformPrompt("Hello")).toEqual([
        { role: "user", content: "Hello" },
      ]);
      expect(transformPrompt([{ role: "user", content: "Hello" }])).toEqual([
        { role: "user", content: "Hello" },
      ]);
    });

    it("should transform useJson correctly", () => {
      const transformUseJson = openAiChatV1.mapBody.useJson.transform as (
        v: any
      ) => any;
      expect(transformUseJson(true)).toBe("json_object");
      expect(transformUseJson(false)).toBe("text");
    });
  });

  describe("openai.chat.v1 effort transform", () => {
    const effortTransform = openAiChatV1.mapBody.effort.transform as (
      v: any,
      s: any
    ) => any;

    it("should return the value for gpt-5 family models", () => {
      expect(effortTransform("low", { model: "gpt-5.2" })).toBe("low");
      expect(effortTransform("medium", { model: "gpt-5-mini" })).toBe("medium");
      expect(effortTransform("high", { model: "gpt-5-nano" })).toBe("high");
      expect(effortTransform("minimal", { model: "gpt-5.2" })).toBe("minimal");
    });

    it("should return the value for o-series reasoning models", () => {
      expect(effortTransform("low", { model: "o3" })).toBe("low");
      expect(effortTransform("high", { model: "o4-mini" })).toBe("high");
    });

    it("should return undefined for unsupported model", () => {
      expect(effortTransform("high", { model: "gpt-4o" })).toBe(undefined);
      expect(effortTransform("high", { model: "gpt-4.1" })).toBe(undefined);
    });

    it("should return undefined for non-string value", () => {
      expect(effortTransform(123, { model: "gpt-5.2" })).toBe(undefined);
    });

    it("should return undefined for unsupported effort level", () => {
      expect(effortTransform("max", { model: "gpt-5.2" })).toBe(undefined);
      expect(effortTransform("xhigh", { model: "gpt-5.2" })).toBe(undefined);
    });

    it("should forward 'none' for gpt-5.x (the only effort that permits sampling params)", () => {
      expect(effortTransform("none", { model: "gpt-5.2" })).toBe("none");
      expect(effortTransform("none", { model: "gpt-5.6-sol" })).toBe("none");
      expect(effortTransform("none", { model: "gpt-4o" })).toBeUndefined();
    });
  });

  // Verified against the live API on 2026-10-08 (gpt-5.2, gpt-5.6-sol) and a
  // 2026-10-06 family-wide probe: every gpt-5.x / o-series model 400s on
  // `max_tokens` ("Use 'max_completion_tokens' instead"); gpt-5.5 / 5.6 400 on
  // any non-default temperature / top_p unless reasoning_effort is "none";
  // gpt-5.1 through 5.4 400 on them whenever an effort other than "none" is
  // sent. Non-reasoning models (gpt-4o, gpt-4.1) accept all of them.
  describe("gpt-5.x request body (reasoning-model rules)", () => {
    const buildBody = (state: Record<string, any>) =>
      mapBody(openAiChatV1.mapBody, {
        prompt: [{ role: "user", content: "hi" }],
        ...state,
      });

    const reasoningModels = [
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-5.2",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.5",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-6-astra",
      "o3",
      "o4-mini",
    ];

    it.each(reasoningModels)(
      "%s: maxTokens is sent as max_completion_tokens, never max_tokens",
      (model) => {
        const body = buildBody({ model, maxTokens: 256 });
        expect(body.max_completion_tokens).toBe(256);
        expect(body.max_tokens).toBeUndefined();
        expect("max_tokens" in body).toBe(false);
      }
    );

    it.each(reasoningModels)(
      "%s: temperature 0 and top_p are dropped with no effort set",
      (model) => {
        const body = buildBody({ model, temperature: 0, topP: 0.9 });
        expect(body.temperature).toBeUndefined();
        expect(body.top_p).toBeUndefined();
        expect("temperature" in body).toBe(false);
        expect("top_p" in body).toBe(false);
      }
    );

    it.each(["minimal", "low", "medium", "high"])(
      "gpt-5.6-sol: temperature and top_p are dropped at effort %s",
      (effort) => {
        const body = buildBody({
          model: "gpt-5.6-sol",
          temperature: 0.2,
          topP: 0.9,
          effort,
        });
        expect(body.temperature).toBeUndefined();
        expect(body.top_p).toBeUndefined();
        expect(body.reasoning_effort).toBe(effort);
      }
    );

    it("gpt-5.6-sol: temperature and top_p are forwarded at effort none", () => {
      const body = buildBody({
        model: "gpt-5.6-sol",
        temperature: 0,
        topP: 0.9,
        effort: "none",
      });
      expect(body.temperature).toBe(0);
      expect(body.top_p).toBe(0.9);
      expect(body.reasoning_effort).toBe("none");
    });

    it("the exact pre-fix failing shape: gpt-5.x with temperature 0 and maxTokens", () => {
      const body = buildBody({
        model: "gpt-5.2",
        temperature: 0,
        maxTokens: 512,
      });
      expect(body).toEqual({
        model: "gpt-5.2",
        messages: [{ role: "user", content: "hi" }],
        max_completion_tokens: 512,
        // The useJson transform always emits a response_format (pre-existing).
        response_format: { type: "text" },
      });
    });

    it.each(["gpt-4o", "gpt-4o-mini", "gpt-4.1"])(
      "%s (non-reasoning): max_tokens, temperature, and top_p are forwarded unchanged",
      (model) => {
        const body = buildBody({
          model,
          temperature: 0,
          topP: 0.9,
          maxTokens: 256,
          effort: "high",
        });
        expect(body.max_tokens).toBe(256);
        expect(body.max_completion_tokens).toBeUndefined();
        expect(body.temperature).toBe(0);
        expect(body.top_p).toBe(0.9);
        expect(body.reasoning_effort).toBeUndefined();
      }
    );
  });

  describe("gpt-5.x rules reach the outgoing request via useLlm", () => {
    const originalFetch = globalThis.fetch;
    let outgoingBody: Record<string, any> = {};

    beforeEach(() => {
      outgoingBody = {};
      globalThis.fetch = (async (_url: any, init: any) => {
        outgoingBody = JSON.parse(init?.body);
        return new Response(
          JSON.stringify({
            id: "chatcmpl-test",
            object: "chat.completion",
            created: 0,
            model: "gpt-test",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "ok" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }) as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    const messages = [{ role: "user" as const, content: "hi" }];

    it("options path: gpt-5.6-sol with temperature 0 and maxTokens sends a clean body", async () => {
      const llm = useLlm("openai.chat.v1", {
        model: "gpt-5.6-sol",
        temperature: 0,
        topP: 0.9,
        maxTokens: 256,
        openAiApiKey: "sk-test",
      });
      await llm.call(messages);

      expect(outgoingBody.model).toBe("gpt-5.6-sol");
      expect(outgoingBody.max_completion_tokens).toBe(256);
      expect(outgoingBody.max_tokens).toBeUndefined();
      expect(outgoingBody.temperature).toBeUndefined();
      expect(outgoingBody.top_p).toBeUndefined();
      expect(outgoingBody.reasoning_effort).toBeUndefined();
    });

    it("shorthand path: openai.gpt-5.2 with effort low keeps effort and drops sampling", async () => {
      const llm = useLlm("openai.gpt-5.2", {
        temperature: 0.2,
        maxTokens: 128,
        effort: "low",
        openAiApiKey: "sk-test",
      });
      await llm.call(messages);

      expect(outgoingBody.model).toBe("gpt-5.2");
      expect(outgoingBody.reasoning_effort).toBe("low");
      expect(outgoingBody.max_completion_tokens).toBe(128);
      expect(outgoingBody.max_tokens).toBeUndefined();
      expect(outgoingBody.temperature).toBeUndefined();
    });

    it("shorthand path: openai.gpt-5.2 with effort none keeps temperature", async () => {
      const llm = useLlm("openai.gpt-5.2", {
        temperature: 0,
        effort: "none",
        openAiApiKey: "sk-test",
      });
      await llm.call(messages);

      expect(outgoingBody.reasoning_effort).toBe("none");
      expect(outgoingBody.temperature).toBe(0);
    });

    it("non-reasoning shorthand: openai.gpt-4o still sends max_tokens and temperature", async () => {
      const llm = useLlm("openai.gpt-4o", {
        temperature: 0,
        maxTokens: 256,
        openAiApiKey: "sk-test",
      });
      await llm.call(messages);

      expect(outgoingBody.max_tokens).toBe(256);
      expect(outgoingBody.max_completion_tokens).toBeUndefined();
      expect(outgoingBody.temperature).toBe(0);
    });
  });

  describe("openai.chat.v1 mapOptions", () => {
    it("should transform functionCall 'any' to 'required'", () => {
      const result = openAiChatV1.mapOptions!.functionCall!("any", {});
      expect(result).toEqual({ tool_choice: "required" });
    });

    it("should transform functionCall 'none'", () => {
      const result = openAiChatV1.mapOptions!.functionCall!("none", {});
      expect(result).toEqual({ tool_choice: "none" });
    });

    it("should transform functionCall 'auto'", () => {
      const result = openAiChatV1.mapOptions!.functionCall!("auto", {});
      expect(result).toEqual({ tool_choice: "auto" });
    });

    it("should pass through specific function call value", () => {
      const specific = { type: "function", function: { name: "my_fn" } };
      const result = openAiChatV1.mapOptions!.functionCall!(
        specific as any,
        {}
      );
      expect(result).toEqual({ tool_choice: specific });
    });

    it("should transform functions to openai tools format", () => {
      const functions = [
        {
          name: "calculate",
          description: "Do math",
          parameters: {
            type: "object",
            properties: { expr: { type: "string" } },
          },
        },
      ];
      const result = openAiChatV1.mapOptions!.functions!(functions, {});
      expect(result).toEqual({
        tools: [
          {
            type: "function",
            function: {
              name: "calculate",
              description: "Do math",
              parameters: expect.objectContaining({
                type: "object",
                properties: { expr: { type: "string" } },
              }),
              strict: false,
            },
          },
        ],
      });
    });

    it("should set strict to true when functionCallStrictInput is enabled", () => {
      const functions = [
        {
          name: "test",
          description: "Test",
          parameters: { type: "object", properties: {} },
        },
      ];
      const result = openAiChatV1.mapOptions!.functions!(functions, {
        functionCallStrictInput: true,
      });
      expect(result.tools[0].function.strict).toBe(true);
    });

    it("should transform jsonSchema correctly", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const result = openAiChatV1.mapOptions!.jsonSchema!(schema, {}, {});
      expect(result).toEqual({
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: expect.objectContaining({
              type: "object",
              properties: { name: { type: "string" } },
            }),
          },
        },
      });
    });

    it("should merge with existing response_format in currentInput", () => {
      const schema = { type: "object", properties: {} };
      const currentInput = { response_format: { existing: true } };
      const result = openAiChatV1.mapOptions!.jsonSchema!(
        schema,
        {},
        currentInput
      );
      expect(result.response_format.existing).toBe(true);
      expect(result.response_format.type).toBe("json_schema");
    });
  });

  describe("openai.chat-mock.v1", () => {
    it("should have the correct key, provider, endpoint, and method", () => {
      expect(openAiChatMockV1.key).toBe("openai.chat-mock.v1");
      expect(openAiChatMockV1.provider).toBe("openai.chat-mock");
      expect(openAiChatMockV1.endpoint).toBe("http://localhost");
      expect(openAiChatMockV1.method).toBe("POST");
    });

    it("should have correct headers", () => {
      expect(openAiChatMockV1.headers).toBe(
        `{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json" }`
      );
    });

    it("should transform useJson correctly", () => {
      const transformUseJson = openAiChatMockV1.mapBody.useJson.transform as (
        v: any
      ) => any;
      expect(transformUseJson(true)).toBe("json_object");
      expect(transformUseJson(false)).toBe("text");
    });
  });

  describe("openai.gpt-4", () => {
    const openAiGpt4 = openai["openai.gpt-4"] as Config;

    it("should be based on openAiChatV1 configuration", () => {
      expect(openAiGpt4.endpoint).toEqual(openAiChatV1.endpoint);
      expect(openAiGpt4.method).toEqual(openAiChatV1.method);
      expect(openAiGpt4.headers).toEqual(openAiChatV1.headers);
    });

    it("should override model in mapBody and options as gpt-4", () => {
      expect(openAiGpt4.mapBody.model).toEqual({
        default: "gpt-4",
        key: "model",
      });
      expect(openAiGpt4.options.model).toEqual({ default: "gpt-4" });
    });
  });

  describe("openai.gpt-6", () => {
    const openAiGpt6 = openai["openai.gpt-6"] as Config;
    const openAiGpt6Astra = openai["openai.gpt-6-astra"] as Config;

    it("should be based on openAiChatV1 configuration", () => {
      expect(openAiGpt6Astra.endpoint).toEqual(openAiChatV1.endpoint);
      expect(openAiGpt6Astra.method).toEqual(openAiChatV1.method);
      expect(openAiGpt6Astra.headers).toEqual(openAiChatV1.headers);
    });

    it("should override model in mapBody and options as gpt-6-astra", () => {
      expect(openAiGpt6Astra.mapBody.model).toEqual({
        default: "gpt-6-astra",
        key: "model",
      });
      expect(openAiGpt6Astra.options.model).toEqual({
        default: "gpt-6-astra",
      });
    });

    it("bare openai.gpt-6 alias resolves to the same model as astra", () => {
      expect(openAiGpt6.options.model.default).toBe(
        openAiGpt6Astra.options.model.default
      );
    });

    it("is registered as a typed shorthand, not just a config entry", () => {
      // Compile-time: fails typecheck if the shorthand is missing from
      // AllUseLlmOptions, which would drop users to the options-based form.
      const keys: UseLlmKey[] = ["openai.gpt-6", "openai.gpt-6-astra"];
      for (const key of keys) {
        expect(openai[key as keyof typeof openai]).toBeDefined();
      }
    });

    it("is not deprecated", () => {
      expect(openAiGpt6.deprecated).toBeUndefined();
      expect(openAiGpt6Astra.deprecated).toBeUndefined();
    });

    it("is treated as a reasoning model, so effort maps to reasoning_effort", () => {
      const effortTransform = openAiChatV1.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      for (const effort of ["minimal", "low", "medium", "high"] as const) {
        expect(effortTransform(effort, { model: "gpt-6-astra" })).toBe(effort);
      }
      expect(
        effortTransform("nonsense", { model: "gpt-6-astra" })
      ).toBeUndefined();
    });
  });

  describe("deprecated shorthands still resolve", () => {
    it.each([
      ["openai.gpt-4.1-nano", "gpt-4.1-nano"],
      ["openai.gpt-4", "gpt-4"],
      ["openai.gpt-5-mini", "gpt-5-mini"],
      ["openai.gpt-5-nano", "gpt-5-nano"],
      ["openai.o3", "o3"],
      ["openai.o4-mini", "o4-mini"],
    ] as const)(
      "%s should resolve to %s",
      (shorthand, expectedModel) => {
        const cfg = openai[shorthand];
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
      }
    );

    it.each(["openai.gpt-4.1-nano", "openai.gpt-4", "openai.o4-mini"] as const)(
      "%s should carry a deprecated payload stamped with its own shorthand",
      (shorthand) => {
        const cfg = openai[shorthand];
        expect(cfg.deprecated).toBeDefined();
        expect(cfg.deprecated!.shorthand).toBe(shorthand);
        expect(cfg.deprecated!.message).toContain(shorthand);
      }
    );

    it.each([
      ["openai.gpt-4.1-nano", "openai.gpt-5.6-luna"],
      ["openai.gpt-4", "openai.gpt-4o"],
    ] as const)(
      "%s should warn about the 2026-10-23 shutdown and point at %s",
      (shorthand, replacement) => {
        const message = openai[shorthand].deprecated!.message;
        expect(message).toContain("2026-10-23");
        expect(message).toContain(replacement);
      }
    );

    it("should not deprecate the gpt-4.1 shorthands that are staying", () => {
      expect(openai["openai.gpt-4.1"].deprecated).toBeUndefined();
      expect(openai["openai.gpt-4.1-mini"].deprecated).toBeUndefined();
      expect(openai["openai.gpt-4o"].deprecated).toBeUndefined();
      expect(openai["openai.gpt-4o-mini"].deprecated).toBeUndefined();
    });

    it.each([
      ["openai.gpt-5-mini", "openai.gpt-5.6-terra"],
      ["openai.gpt-5-nano", "openai.gpt-5.6-luna"],
      ["openai.o3", "openai.gpt-5.6"],
    ] as const)(
      "%s carries a deprecation notice pointing at %s",
      (shorthand, replacement) => {
        const cfg = openai[shorthand] as Config;
        expect(cfg.deprecated).toBeDefined();
        expect(cfg.deprecated!.shorthand).toBe(shorthand);
        expect(cfg.deprecated!.message).toContain("2026-12-11");
        expect(cfg.deprecated!.message).toContain(replacement);
      }
    );

    it("does not deprecate the 5.6 replacements", () => {
      for (const key of [
        "openai.gpt-5.6",
        "openai.gpt-5.6-terra",
        "openai.gpt-5.6-luna",
      ] as const) {
        expect((openai[key] as Config).deprecated).toBeUndefined();
      }
    });
  });

  describe("all shorthands resolve to expected default model", () => {
    it.each([
      ["openai.gpt-6", "gpt-6-astra"],
      ["openai.gpt-6-astra", "gpt-6-astra"],
      ["openai.gpt-5.6", "gpt-5.6-sol"],
      ["openai.gpt-5.6-terra", "gpt-5.6-terra"],
      ["openai.gpt-5.6-luna", "gpt-5.6-luna"],
      ["openai.gpt-5.5", "gpt-5.5"],
      ["openai.gpt-5.4", "gpt-5.4"],
      ["openai.gpt-5.4-mini", "gpt-5.4-mini"],
      ["openai.gpt-5.2", "gpt-5.2"],
      ["openai.gpt-5-mini", "gpt-5-mini"],
      ["openai.gpt-5-nano", "gpt-5-nano"],
      ["openai.gpt-4.1", "gpt-4.1"],
      ["openai.gpt-4.1-mini", "gpt-4.1-mini"],
      ["openai.gpt-4.1-nano", "gpt-4.1-nano"],
      ["openai.o3", "o3"],
      ["openai.gpt-4", "gpt-4"],
      ["openai.gpt-4o", "gpt-4o"],
      ["openai.gpt-4o-mini", "gpt-4o-mini"],
      ["openai.o4-mini", "o4-mini"],
    ] as const)(
      "%s should resolve to %s and share base config",
      (shorthand, expectedModel) => {
        const cfg = openai[shorthand] as Config;
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
        expect(cfg.mapBody.model).toEqual({
          default: expectedModel,
          key: "model",
        });
        // All shorthands should inherit base provider/endpoint/method/headers
        expect(cfg.key).toBe(openAiChatV1.key);
        expect(cfg.provider).toBe(openAiChatV1.provider);
        expect(cfg.endpoint).toBe(openAiChatV1.endpoint);
        expect(cfg.method).toBe(openAiChatV1.method);
        expect(cfg.headers).toBe(openAiChatV1.headers);
      }
    );

    it("reasoning models receive effort, non-reasoning shorthands do not", () => {
      const effortTransform = openAiChatV1.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      const reasoningShorthands = [
        "openai.gpt-6",
        "openai.gpt-6-astra",
        "openai.gpt-5.6",
        "openai.gpt-5.6-terra",
        "openai.gpt-5.6-luna",
        "openai.gpt-5.5",
        "openai.gpt-5.4",
        "openai.gpt-5.4-mini",
        "openai.gpt-5.2",
        "openai.gpt-5-mini",
        "openai.gpt-5-nano",
        "openai.o3",
        "openai.o4-mini",
      ] as const;
      const nonReasoningShorthands = [
        "openai.gpt-4.1",
        "openai.gpt-4.1-mini",
        "openai.gpt-4.1-nano",
        "openai.gpt-4",
        "openai.gpt-4o",
        "openai.gpt-4o-mini",
      ] as const;

      for (const key of reasoningShorthands) {
        const model = (openai[key] as Config).options.model.default as string;
        expect(effortTransform("high", { model })).toBe("high");
      }
      for (const key of nonReasoningShorthands) {
        const model = (openai[key] as Config).options.model.default as string;
        expect(effortTransform("high", { model })).toBeUndefined();
      }
    });
  });

  describe("openai.gpt-4o", () => {
    it("should be based on openAiChatV1 configuration", () => {
      expect(openAiGpt4o.endpoint).toEqual(openAiChatV1.endpoint);
      expect(openAiGpt4o.method).toEqual(openAiChatV1.method);
      expect(openAiGpt4o.headers).toEqual(openAiChatV1.headers);
    });

    it("should override model in mapBody and options as gpt-4o", () => {
      expect(openAiGpt4o.mapBody.model).toEqual({
        default: "gpt-4o",
        key: "model",
      });
      expect(openAiGpt4o.options.model).toEqual({ default: "gpt-4o" });
    });
  });
});
