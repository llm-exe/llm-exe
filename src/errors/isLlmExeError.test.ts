import { isLlmExeError } from "./isLlmExeError";
import { LlmExeError, LLM_EXE_ERROR_SYMBOL } from "./LlmExeError";

describe("isLlmExeError", () => {
  it("returns true for an LlmExeError instance", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(isLlmExeError(err)).toBe(true);
  });

  it("returns false for a plain Error", () => {
    expect(isLlmExeError(new Error("nope"))).toBe(false);
  });

  it("returns false for non-objects", () => {
    expect(isLlmExeError(null)).toBe(false);
    expect(isLlmExeError(undefined)).toBe(false);
    expect(isLlmExeError("string")).toBe(false);
    expect(isLlmExeError(0)).toBe(false);
    expect(isLlmExeError(true)).toBe(false);
  });

  it("returns true for duplicate-package shape via symbol marker", () => {
    const duplicate = {
      message: "from another copy",
      code: "parser.invalid_type",
      [LLM_EXE_ERROR_SYMBOL]: true,
    };
    expect(isLlmExeError(duplicate)).toBe(true);
  });

  it("returns true for objects with boolean marker only", () => {
    const fallback = {
      message: "marker only",
      code: "parser.invalid_type",
      isLlmExeError: true,
    };
    expect(isLlmExeError(fallback)).toBe(true);
  });

  it("returns false for objects without any marker", () => {
    const fake = { message: "fake", code: "parser.invalid_type" };
    expect(isLlmExeError(fake)).toBe(false);
  });

  it("narrows on a single code", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(isLlmExeError(err, "parser.invalid_type")).toBe(true);
    expect(isLlmExeError(err, "parser.parse_failed")).toBe(false);
  });

  it("narrows on a code array", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    expect(
      isLlmExeError(err, [
        "parser.invalid_type",
        "parser.parse_failed",
      ] as const)
    ).toBe(true);
    expect(
      isLlmExeError(err, [
        "parser.parse_failed",
        "parser.invalid_input",
      ] as const)
    ).toBe(false);
  });
});
