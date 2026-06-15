import { LlmExeError, LLM_EXE_ERROR_SYMBOL } from "./LlmExeError";

describe("LlmExeError", () => {
  it("is an instance of Error", () => {
    const err = new LlmExeError("boom", { code: "parser.invalid_type" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LlmExeError);
  });

  it("has a stable name", () => {
    const err = new LlmExeError("boom", { code: "parser.invalid_type" });
    expect(err.name).toBe("LlmExeError");
  });

  it("does not expose name in enumerable error output", () => {
    const err = new LlmExeError("boom", { code: "parser.invalid_type" });
    expect(Object.keys(err)).not.toContain("name");
    expect(Object.prototype.propertyIsEnumerable.call(err, "name")).toBe(
      false
    );
  });

  it("preserves message", () => {
    const err = new LlmExeError("the message", { code: "parser.invalid_type" });
    expect(err.message).toBe("the message");
  });

  it("preserves code", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(err.code).toBe("parser.invalid_type");
  });

  it("derives category from code", () => {
    const parser = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(parser.category).toBe("parser");

    const config = new LlmExeError("x", {
      code: "configuration.missing_provider",
    });
    expect(config.category).toBe("configuration");

    const llm = new LlmExeError("x", { code: "llm.provider_rate_limited" });
    expect(llm.category).toBe("llm");
  });

  it("preserves context", () => {
    const err = new LlmExeError("x", {
      code: "parser.invalid_type",
      context: { parser: "json", availableParsers: ["json", "string"] },
    });
    expect(err.context).toEqual({
      parser: "json",
      availableParsers: ["json", "string"],
    });
  });

  it("preserves cause", () => {
    const original = new Error("root cause");
    const err = new LlmExeError("x", {
      code: "parser.invalid_type",
      cause: original,
    });
    expect((err as { cause?: unknown }).cause).toBe(original);
  });

  it("exposes isLlmExeError marker", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(err.isLlmExeError).toBe(true);
  });

  it("does not expose isLlmExeError marker in enumerable error output", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(Object.keys(err)).not.toContain("isLlmExeError");
    expect(
      Object.prototype.propertyIsEnumerable.call(err, "isLlmExeError")
    ).toBe(false);
  });

  it("exposes Symbol.for('llm-exe.error') marker", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect((err as unknown as Record<symbol, unknown>)[LLM_EXE_ERROR_SYMBOL]).toBe(
      true
    );
  });

  it("does not expose Symbol.for('llm-exe.error') marker in enumerable error output", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(Object.getOwnPropertySymbols(err)).toContain(LLM_EXE_ERROR_SYMBOL);
    expect(
      Object.prototype.propertyIsEnumerable.call(err, LLM_EXE_ERROR_SYMBOL)
    ).toBe(false);
  });

  it("converts invalid code to internal.invariant_failed", () => {
    const err = new LlmExeError("x", { code: "nonsense" as any });
    expect(err.code).toBe("internal.invariant_failed");
    expect(err.category).toBe("internal");
    expect(err.context).toEqual({
      invariant: "invalid_error_code",
      received: "nonsense",
    });
  });

  it("rejects unknown codes even when the prefix looks like a valid category", () => {
    // The category prefix "parser" is valid, but "parser.typo" is not a registered code.
    // The full code must match the public catalog, not just the prefix.
    const err = new LlmExeError("x", { code: "parser.typo" as any });
    expect(err.code).toBe("internal.invariant_failed");
    expect(err.category).toBe("internal");
    expect(err.context).toEqual({
      invariant: "invalid_error_code",
      received: "parser.typo",
    });
  });

  it("converts missing code to internal.invariant_failed", () => {
    const err = new LlmExeError("x", {} as any);
    expect(err.code).toBe("internal.invariant_failed");
    expect(err.category).toBe("internal");
  });

  it("captures a stack trace", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(typeof err.stack).toBe("string");
    expect(err.stack).toContain("LlmExeError");
  });

  it("survives async rejection paths as an error object", async () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    await expect(Promise.reject(err)).rejects.toBe(err);
    await expect(Promise.reject(err)).rejects.toBeInstanceOf(LlmExeError);
  });

  it("toJSON returns structured output", () => {
    const err = new LlmExeError("the message", {
      code: "parser.invalid_type",
      context: { parser: "json", availableParsers: ["json"] },
    });
    const json = err.toJSON();
    expect(json).toEqual({
      name: "LlmExeError",
      message: "the message",
      category: "parser",
      code: "parser.invalid_type",
      context: { parser: "json", availableParsers: ["json"] },
    });
  });

  it("JSON.stringify produces useful output", () => {
    const err = new LlmExeError("the message", {
      code: "parser.invalid_type",
      context: { parser: "json" },
    });
    const json = JSON.parse(JSON.stringify(err));
    expect(json.name).toBe("LlmExeError");
    expect(json.code).toBe("parser.invalid_type");
    expect(json.category).toBe("parser");
    expect(json.message).toBe("the message");
  });

  it("JSON.stringify does not recurse on cyclic cause", () => {
    const a: { name: string; message: string; cause?: unknown } = {
      name: "A",
      message: "a",
    };
    a.cause = a;
    const err = new LlmExeError("x", {
      code: "parser.invalid_type",
      cause: a,
    });
    const json = JSON.stringify(err);
    expect(json).toContain("[Circular]");
  });

  it("JSON.stringify does not recurse on cyclic context", () => {
    const ctx: { parser: string; back?: unknown } = { parser: "json" };
    ctx.back = ctx;
    const err = new LlmExeError("x", {
      code: "parser.invalid_type",
      context: ctx as any,
    });
    const json = JSON.stringify(err);
    expect(json).toContain("[Circular]");
  });

  it("String(error) remains useful", () => {
    const err = new LlmExeError("the message", {
      code: "parser.invalid_type",
    });
    expect(String(err)).toBe("LlmExeError: the message");
  });

  it("falls back to internal.invariant_failed when constructed with no options", () => {
    const err = new (LlmExeError as any)("no options at all");
    expect(err.code).toBe("internal.invariant_failed");
    expect(err.category).toBe("internal");
    expect(err.context).toEqual({
      invariant: "invalid_error_code",
      received: undefined,
    });
  });
});
