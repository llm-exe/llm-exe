import { KNOWN_ERROR_CODES } from "./knownCodes";
import type { ErrorCategory } from "./types";

const EXPECTED_CATEGORIES: ReadonlySet<ErrorCategory> = new Set([
  "unknown",
  "configuration",
  "llm",
  "embedding",
  "prompt",
  "parser",
  "executor",
  "callable",
  "state",
  "request",
  "auth",
  "template",
  "internal",
]);

describe("KNOWN_ERROR_CODES", () => {
  it("is a non-empty ReadonlySet", () => {
    expect(KNOWN_ERROR_CODES).toBeInstanceOf(Set);
    expect(KNOWN_ERROR_CODES.size).toBeGreaterThan(0);
  });

  it("contains representative codes used across the codebase", () => {
    expect(KNOWN_ERROR_CODES.has("unknown.unclassified")).toBe(true);
    expect(KNOWN_ERROR_CODES.has("parser.invalid_type")).toBe(true);
    expect(KNOWN_ERROR_CODES.has("llm.provider_http_error")).toBe(true);
    expect(KNOWN_ERROR_CODES.has("internal.invariant_failed")).toBe(true);
  });

  it("does not contain unregistered codes", () => {
    expect(KNOWN_ERROR_CODES.has("parser.does_not_exist")).toBe(false);
    expect(KNOWN_ERROR_CODES.has("bogus.code")).toBe(false);
    expect(KNOWN_ERROR_CODES.has("")).toBe(false);
  });

  it("every code follows the `category.subcode` shape", () => {
    for (const code of KNOWN_ERROR_CODES) {
      expect(code).toMatch(/^[a-z]+\.[a-z_]+$/);
      const parts = code.split(".");
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    }
  });

  it("every code's category prefix is a known ErrorCategory", () => {
    for (const code of KNOWN_ERROR_CODES) {
      const category = code.slice(0, code.indexOf("."));
      expect(EXPECTED_CATEGORIES.has(category as ErrorCategory)).toBe(true);
    }
  });

  it("has no duplicate entries (set size equals iterated count)", () => {
    const iterated = [...KNOWN_ERROR_CODES];
    expect(iterated.length).toBe(KNOWN_ERROR_CODES.size);
    expect(new Set(iterated).size).toBe(iterated.length);
  });
});
