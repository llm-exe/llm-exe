import { anthropicFunctionCall, anthropicFunctions } from "./mapOptions";
import { LlmExeError } from "@/errors";

// Shared by the direct Anthropic and Bedrock configs. The provider-level behavior
// is also exercised through anthropic.test.ts / bedrock.test.ts; these focus on
// the tool_choice shaping and the thinking-incompatibility gate (issue #720).
describe("anthropic mapOptions (shared direct + bedrock)", () => {
  const cfg = { provider: "anthropic.chat" } as any;

  describe("anthropicFunctionCall — tool_choice shape", () => {
    it("maps 'none' to the _clearFunctions sentinel", () => {
      expect(anthropicFunctionCall("none")).toEqual({ _clearFunctions: true });
    });

    it("maps 'auto' to { tool_choice: { type: 'auto' } }", () => {
      expect(anthropicFunctionCall("auto")).toEqual({
        tool_choice: { type: "auto" },
      });
    });

    it("maps 'any' to { tool_choice: { type: 'any' } }", () => {
      expect(anthropicFunctionCall("any")).toEqual({
        tool_choice: { type: "any" },
      });
    });

    it("maps a named tool { name } to { type: 'tool', name } (issue #720)", () => {
      expect(anthropicFunctionCall({ name: "get_time" })).toEqual({
        tool_choice: { type: "tool", name: "get_time" },
      });
    });

    it("normalizes an already-typed { type: 'tool', name } to the same shape", () => {
      expect(
        anthropicFunctionCall({ type: "tool", name: "get_time" } as any)
      ).toEqual({ tool_choice: { type: "tool", name: "get_time" } });
    });

    it("forwards an off-type shape unchanged as a defensive fallback", () => {
      // GenericFunctionCall is "auto" | "none" | "any" | { name }; a bare string
      // is off-type and passes through rather than being coerced or dropped.
      expect(anthropicFunctionCall("my_func" as any)).toEqual({
        tool_choice: "my_func",
      });
    });
  });

  describe("anthropicFunctionCall — thinking incompatibility (issue #720)", () => {
    const enabled = { thinking: { type: "enabled", budget_tokens: 4096 } };
    const adaptive = { thinking: { type: "adaptive" } };

    it("throws a typed error for a forced 'any' tool_choice with extended (enabled) thinking", () => {
      let err: unknown;
      try {
        anthropicFunctionCall("any", {}, enabled, cfg);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(LlmExeError);
      expect((err as LlmExeError).code).toBe(
        "configuration.incompatible_options"
      );
      expect((err as LlmExeError).category).toBe("configuration");
    });

    it("throws for a named tool_choice with extended (enabled) thinking", () => {
      expect(() =>
        anthropicFunctionCall({ name: "x" }, {}, enabled, cfg)
      ).toThrow(/forced tool_choice/i);
    });

    it("does NOT throw for a forced tool_choice with adaptive thinking (valid on the direct API)", () => {
      expect(anthropicFunctionCall("any", {}, adaptive, cfg)).toEqual({
        tool_choice: { type: "any" },
      });
      expect(anthropicFunctionCall({ name: "x" }, {}, adaptive, cfg)).toEqual({
        tool_choice: { type: "tool", name: "x" },
      });
    });

    it("does NOT throw for 'auto'/'none' even with extended thinking", () => {
      expect(anthropicFunctionCall("auto", {}, enabled, cfg)).toEqual({
        tool_choice: { type: "auto" },
      });
      expect(anthropicFunctionCall("none", {}, enabled, cfg)).toEqual({
        _clearFunctions: true,
      });
    });

    it("does NOT throw for a forced tool_choice when thinking is absent", () => {
      expect(anthropicFunctionCall("any", {}, {}, cfg)).toEqual({
        tool_choice: { type: "any" },
      });
    });
  });

  describe("anthropicFunctions", () => {
    it("maps functions to Anthropic tools with a cleaned input_schema", () => {
      const out = anthropicFunctions([
        {
          name: "f",
          description: "d",
          parameters: { type: "object", properties: { a: { type: "string" } } },
        },
      ]);
      expect(out.tools[0]).toEqual(
        expect.objectContaining({
          name: "f",
          description: "d",
          input_schema: expect.objectContaining({ type: "object" }),
        })
      );
    });
  });
});
