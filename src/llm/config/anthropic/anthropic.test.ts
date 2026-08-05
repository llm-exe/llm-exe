import { anthropic } from "@/llm/config/anthropic";
import { mapBody } from "@/llm/_utils.mapBody";
import { anthropicPromptSanitize } from "./promptSanitize";
import { useLlm } from "@/llm";

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
          effort: expect.any(Object),
          maxTokens: expect.any(Object),
          anthropicApiKey: expect.any(Object),
        }),
        mapBody: expect.objectContaining({
          model: expect.any(Object),
          maxTokens: expect.any(Object),
          system: expect.any(Object),
          effort: expect.any(Object),
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

  describe("effort transform", () => {
    const effortTransform = config.mapBody.effort.transform as (
      v: any,
      s: any,
      output: any
    ) => any;

    describe("adaptive thinking (4.6+ models)", () => {
      it.each([
        ["claude-opus-4-6", "low", "low"],
        ["claude-opus-4-6", "minimal", "low"],
        ["claude-opus-4-6", "medium", "medium"],
        ["claude-opus-4-6", "high", "high"],
        ["claude-sonnet-4-6", "low", "low"],
        ["claude-sonnet-4-6", "high", "high"],
        // Newer adaptive models (opus 5, opus 4.8, sonnet 5, fable 5)
        // Opus 5 keeps "high" (Anthropic recommends starting at high on Opus 5),
        // unlike opus 4.7/4.8 which escalate to xhigh.
        ["claude-opus-5", "high", "high"],
        ["claude-opus-5", "minimal", "low"],
        ["claude-opus-5", "medium", "medium"],
        ["claude-opus-4-8", "high", "xhigh"],
        ["claude-opus-4-8", "medium", "medium"],
        ["claude-sonnet-5", "high", "high"],
        ["claude-sonnet-5", "low", "low"],
        ["claude-fable-5", "high", "high"],
        ["claude-fable-5", "medium", "medium"],
      ] as const)(
        "%s with effort '%s' should return '%s'",
        (model, effort, expected) => {
          const output: Record<string, any> = {};
          const result = effortTransform(effort, { model }, output);
          expect(result).toBe(expected);
          expect(output.thinking).toEqual({ type: "adaptive" });
        }
      );
    });

    describe("adaptive thinking maps high to xhigh for Opus 4.7/4.8 only", () => {
      it.each(["claude-opus-4-7", "claude-opus-4-8"])(
        "should map high to xhigh for %s",
        (model) => {
          const output: Record<string, any> = {};
          const result = effortTransform("high", { model }, output);
          expect(result).toBe("xhigh");
          expect(output.thinking).toEqual({ type: "adaptive" });
        }
      );

      it("keeps high for adaptive models without the xhigh escalation", () => {
        // Opus 5 sits here on purpose: Anthropic's per-model guidance is to
        // start with "high" on Opus 5 and warns against carrying the 4.x
        // escalation over, so "high" must remain reachable. Do not add opus-5
        // back to the xhigh list above.
        for (const model of ["claude-opus-5", "claude-sonnet-5", "claude-fable-5"]) {
          const output: Record<string, any> = {};
          expect(effortTransform("high", { model }, output)).toBe("high");
        }
      });

      it("should map medium normally for opus-4-7", () => {
        const output: Record<string, any> = {};
        const result = effortTransform("medium", { model: "claude-opus-4-7" }, output);
        expect(result).toBe("medium");
        expect(output.thinking).toEqual({ type: "adaptive" });
      });
    });

    describe("legacy thinking (4.5 models)", () => {
      it.each([
        ["claude-sonnet-4-5-20250929", "minimal", 1024],
        ["claude-sonnet-4-5-20250929", "low", 4096],
        ["claude-sonnet-4-5-20250929", "medium", 10240],
        ["claude-sonnet-4-5-20250929", "high", 32768],
        ["claude-haiku-4-5-20251001", "medium", 10240],
        ["claude-opus-4-5-20251101", "high", 32768],
      ] as const)(
        "%s with effort '%s' should set budget_tokens to %d",
        (model, effort, expectedBudget) => {
          const output: Record<string, any> = {};
          const result = effortTransform(effort, { model }, output);
          expect(result).toBeUndefined();
          expect(output.thinking).toEqual({
            type: "enabled",
            budget_tokens: expectedBudget,
          });
        }
      );
    });

    describe("unsupported models (3.x)", () => {
      it.each([
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
        "claude-3-opus-20240229",
        "claude-3-7-sonnet-20250219",
      ])("%s should return undefined and not set thinking", (model) => {
        const output: Record<string, any> = {};
        const result = effortTransform("high", { model }, output);
        expect(result).toBeUndefined();
        expect(output.thinking).toBeUndefined();
      });
    });

    describe("invalid effort values", () => {
      it("should return undefined for non-string value", () => {
        const output: Record<string, any> = {};
        expect(effortTransform(123, { model: "claude-opus-4-6" }, output)).toBeUndefined();
        expect(output.thinking).toBeUndefined();
      });

      it("should return undefined for unsupported effort string", () => {
        const output: Record<string, any> = {};
        expect(effortTransform("max", { model: "claude-opus-4-6" }, output)).toBeUndefined();
        expect(output.thinking).toBeUndefined();
      });

      it("should return undefined when effort is undefined", () => {
        const output: Record<string, any> = {};
        expect(effortTransform(undefined, { model: "claude-opus-4-6" }, output)).toBeUndefined();
        expect(output.thinking).toBeUndefined();
      });
    });
  });

  describe("effort mapBody integration", () => {
    const prompt = [{ role: "user", content: "Hello" }];

    it("should produce adaptive thinking body for opus-4-6", () => {
      const body = mapBody(config.mapBody, {
        model: "claude-opus-4-6",
        maxTokens: 4096,
        effort: "high",
        prompt,
      });
      expect(body).toEqual(
        expect.objectContaining({
          model: "claude-opus-4-6",
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
        })
      );
    });

    it("should produce legacy thinking body for sonnet-4-5", () => {
      const body = mapBody(config.mapBody, {
        model: "claude-sonnet-4-5-20250929",
        maxTokens: 4096,
        effort: "medium",
        prompt,
      });
      expect(body).toEqual(
        expect.objectContaining({
          model: "claude-sonnet-4-5-20250929",
          thinking: { type: "enabled", budget_tokens: 10240 },
        })
      );
      expect(body).not.toHaveProperty("output_config");
    });

    it("raises max_tokens above budget_tokens for legacy models (Anthropic requires max_tokens > budget)", () => {
      // Default maxTokens (4096) <= medium budget (10240) would 400 without this.
      const body = mapBody(config.mapBody, {
        model: "claude-sonnet-4-5-20250929",
        maxTokens: 4096,
        effort: "medium",
        prompt,
      });
      expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 10240 });
      expect(body.max_tokens).toBeGreaterThan(10240);
    });

    it("does not lower a caller's already-larger max_tokens for legacy models", () => {
      const body = mapBody(config.mapBody, {
        model: "claude-sonnet-4-5-20250929",
        maxTokens: 50000,
        effort: "medium",
        prompt,
      });
      expect(body.max_tokens).toBe(50000);
    });

    it("produces adaptive body with xhigh for opus-4-8 (newer flagship)", () => {
      const body = mapBody(config.mapBody, {
        model: "claude-opus-4-8",
        maxTokens: 4096,
        effort: "high",
        prompt,
      });
      expect(body).toEqual(
        expect.objectContaining({
          thinking: { type: "adaptive" },
          output_config: { effort: "xhigh" },
        })
      );
    });

    it("should not add thinking fields for claude-3 models", () => {
      const body = mapBody(config.mapBody, {
        model: "claude-3-5-sonnet-latest",
        maxTokens: 4096,
        effort: "high",
        prompt,
      });
      expect(body).not.toHaveProperty("thinking");
      expect(body).not.toHaveProperty("output_config");
    });
  });

  describe("deprecated shorthands still resolve", () => {
    it.each([
      ["anthropic.claude-opus-4-6", "claude-opus-4-6"],
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
      ["anthropic.claude-opus-5", "claude-opus-5"],
      ["anthropic.claude-opus-4-8", "claude-opus-4-8"],
      ["anthropic.claude-sonnet-5", "claude-sonnet-5"],
      ["anthropic.claude-opus-4-7", "claude-opus-4-7"],
      ["anthropic.claude-sonnet-4-6", "claude-sonnet-4-6"],
      ["anthropic.claude-opus-4-5", "claude-opus-4-5"],
      ["anthropic.claude-haiku-4-5", "claude-haiku-4-5"],
      ["anthropic.claude-sonnet-4-5", "claude-sonnet-4-5"],
    ] as const)(
      "%s should resolve to %s",
      (shorthand, expectedModel) => {
        const cfg = anthropic[shorthand];
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
      }
    );
  });

  describe("removed shorthands", () => {
    it("no longer exposes anthropic.claude-opus-4-1 (model retired Aug 5, 2026)", () => {
      expect(
        (anthropic as Record<string, unknown>)["anthropic.claude-opus-4-1"]
      ).toBeUndefined();
    });

    it.each([
      "anthropic.claude-opus-4",
      "anthropic.claude-sonnet-4",
    ])("no longer exposes %s (model retired at Anthropic — HTTP 404)", (shorthand) => {
      expect(
        (anthropic as Record<string, unknown>)[shorthand]
      ).toBeUndefined();
    });
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

    it("drops temperature, top_p, and top_k for claude-opus-5", () => {
      const body = buildBody({
        model: "claude-opus-5",
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
      });
      expect(body.temperature).toBeUndefined();
      expect(body.top_p).toBeUndefined();
      expect(body.top_k).toBeUndefined();
    });

    it("drops temperature, top_p, and top_k for claude-sonnet-5", () => {
      const body = buildBody({
        model: "claude-sonnet-5",
        temperature: 0.5,
        topP: 0.9,
        topK: 40,
      });
      expect(body.temperature).toBeUndefined();
      expect(body.top_p).toBeUndefined();
      expect(body.top_k).toBeUndefined();
    });

    it("drops temperature, top_p, and top_k for claude-fable-5", () => {
      const body = buildBody({
        model: "claude-fable-5",
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

  // Regression tests for issue #661: the tests above call mapBody directly,
  // which bypasses stateFromOptions. These go through the public useLlm path
  // so an option key missing from config.options can't silently drop a param.
  describe("options reach the outgoing request body via useLlm (issue #661)", () => {
    const originalFetch = globalThis.fetch;
    let outgoingBody: Record<string, any> = {};

    beforeEach(() => {
      outgoingBody = {};
      globalThis.fetch = (async (_url: any, init: any) => {
        outgoingBody = JSON.parse(init?.body);
        return new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-test",
            content: [{ type: "text", text: "ok" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }) as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    const messages = [{ role: "user" as const, content: "hi" }];

    it("forwards temperature, top_k, stop_sequences, metadata, and service_tier", async () => {
      const llm = useLlm("anthropic.claude-sonnet-4-6", {
        temperature: 0.5,
        topK: 40,
        stopSequences: ["END"],
        metadata: { user_id: "user-123" },
        serviceTier: "auto",
        anthropicApiKey: "sk-ant-test",
      });
      await llm.call(messages);

      expect(outgoingBody.temperature).toBe(0.5);
      expect(outgoingBody.top_k).toBe(40);
      expect(outgoingBody.stop_sequences).toEqual(["END"]);
      expect(outgoingBody.metadata).toEqual({ user_id: "user-123" });
      expect(outgoingBody.service_tier).toBe("auto");
    });

    it("forwards top_p when temperature is not set (Claude 4.x)", async () => {
      const llm = useLlm("anthropic.claude-sonnet-4-6", {
        topP: 0.9,
        anthropicApiKey: "sk-ant-test",
      });
      await llm.call(messages);

      expect(outgoingBody.top_p).toBe(0.9);
    });

    it("drops top_p but keeps temperature when both are set (Claude 4.x)", async () => {
      const llm = useLlm("anthropic.claude-sonnet-4-6", {
        temperature: 0.5,
        topP: 0.9,
        anthropicApiKey: "sk-ant-test",
      });
      await llm.call(messages);

      expect(outgoingBody.temperature).toBe(0.5);
      expect(outgoingBody.top_p).toBeUndefined();
    });

    it("forwards both temperature and top_p on Claude 3.x", async () => {
      const llm = useLlm("anthropic.chat.v1", {
        model: "claude-3-5-sonnet-latest",
        temperature: 0.5,
        topP: 0.9,
        anthropicApiKey: "sk-ant-test",
      });
      await llm.call(messages);

      expect(outgoingBody.temperature).toBe(0.5);
      expect(outgoingBody.top_p).toBe(0.9);
    });

    it.each([
      ["anthropic.claude-opus-5"],
      ["anthropic.claude-opus-4-7"],
      ["anthropic.claude-opus-4-8"],
      ["anthropic.claude-sonnet-5"],
      ["anthropic.claude-fable-5"],
    ] as const)(
      "%s drops all sampling params (model 400s if they are sent)",
      async (shorthand) => {
        const llm = useLlm(shorthand, {
          temperature: 0.5,
          topP: 0.9,
          topK: 40,
          anthropicApiKey: "sk-ant-test",
        });
        await llm.call(messages);

        expect(outgoingBody.temperature).toBeUndefined();
        expect(outgoingBody.top_p).toBeUndefined();
        expect(outgoingBody.top_k).toBeUndefined();
      }
    );

    it("never forwards stream (no SSE support in the request pipeline)", async () => {
      const llm = useLlm("anthropic.claude-sonnet-4-6", {
        stream: true,
        anthropicApiKey: "sk-ant-test",
      });
      await llm.call(messages);

      expect(outgoingBody.stream).toBeUndefined();
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

  describe("image content through mapBody", () => {
    it("converts image_url blocks into anthropic image sources in the request body", () => {
      const body = mapBody(config.mapBody, {
        model: "claude-sonnet-5",
        maxTokens: 1024,
        prompt: [
          { role: "system", content: "You are helpful" },
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this image?" },
              {
                type: "image_url",
                image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
              },
              {
                type: "image_url",
                image_url: { url: "https://example.com/cat.png" },
              },
            ],
          },
        ],
      });

      expect(body.system).toBe("You are helpful");
      expect(body.messages).toEqual([
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image?" },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: "iVBORw0KGgo=",
              },
            },
            {
              type: "image",
              source: { type: "url", url: "https://example.com/cat.png" },
            },
          ],
        },
      ]);
    });
  });
});
