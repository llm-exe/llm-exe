import { BaseParser, BooleanParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the BooleanParser class
 */
describe("llm-exe:parser/BooleanParser", () => {
  let originalDebugEnv: string | undefined;

  beforeEach(() => {
    originalDebugEnv = process.env.LLM_EXE_DEBUG;
    delete process.env.LLM_EXE_DEBUG;
  });

  afterEach(() => {
    if (originalDebugEnv === undefined) {
      delete process.env.LLM_EXE_DEBUG;
    } else {
      process.env.LLM_EXE_DEBUG = originalDebugEnv;
    }
  });

  it("creates class with expected properties", () => {
    const parser = new BooleanParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(BooleanParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("boolean");
  });
  it('parses "true" as true', () => {
    const parser = new BooleanParser();
    expect(parser.parse("true")).toEqual(true);
  });
  it('parses "True" as true (case-insensitive)', () => {
    const parser = new BooleanParser();
    expect(parser.parse("True")).toEqual(true);
  });
  it('parses "yes" as true', () => {
    const parser = new BooleanParser();
    expect(parser.parse("yes")).toEqual(true);
  });
  it('parses "Yes" as true (case-insensitive)', () => {
    const parser = new BooleanParser();
    expect(parser.parse("Yes")).toEqual(true);
  });
  it('parses "y" as true', () => {
    const parser = new BooleanParser();
    expect(parser.parse("y")).toEqual(true);
  });
  it('parses "1" as true', () => {
    const parser = new BooleanParser();
    expect(parser.parse("1")).toEqual(true);
  });
  it('parses "false" as false', () => {
    const parser = new BooleanParser();
    expect(parser.parse("false")).toEqual(false);
  });
  it('parses "no" as false', () => {
    const parser = new BooleanParser();
    expect(parser.parse("no")).toEqual(false);
  });
  it('parses "0" as false', () => {
    const parser = new BooleanParser();
    expect(parser.parse("0")).toEqual(false);
  });
  it('parses "n" as false', () => {
    const parser = new BooleanParser();
    expect(parser.parse("n")).toEqual(false);
  });
  it("handles whitespace around value", () => {
    const parser = new BooleanParser();
    expect(parser.parse("  yes  ")).toEqual(true);
  });
  it("throws parser.parse_failed for empty input", () => {
    const parser = new BooleanParser();
    try {
      parser.parse("");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "BooleanParser.parse",
        parser: "boolean",
        reason: "empty_input",
        expected: ["true", "false", "yes", "no", "y", "n", "1", "0"],
        inputLength: 0,
      });
    }
  });
  it("throws parser.parse_failed for whitespace-only input", () => {
    const parser = new BooleanParser();
    try {
      parser.parse("   ");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "BooleanParser.parse",
        parser: "boolean",
        reason: "empty_input",
        expected: ["true", "false", "yes", "no", "y", "n", "1", "0"],
        inputLength: 3,
      });
    }
  });
  it("throws parser.parse_failed for unrecognized boolean text", () => {
    const parser = new BooleanParser();
    try {
      parser.parse("maybe");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "BooleanParser.parse",
        parser: "boolean",
        reason: "unrecognized_boolean",
        expected: ["true", "false", "yes", "no", "y", "n", "1", "0"],
        match: "exact",
        inputLength: 5,
      });
    }
  });
  it("throws parser.parse_failed instead of extracting boolean values from prose", () => {
    const parser = new BooleanParser();
    expect(() => parser.parse("The answer is true.")).toThrow(LlmExeError);
  });
  it("throws parser.parse_failed instead of treating conflicting prose as ambiguous extraction", () => {
    const parser = new BooleanParser();
    try {
      parser.parse("true and false");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "BooleanParser.parse",
        parser: "boolean",
        reason: "unrecognized_boolean",
        expected: ["true", "false", "yes", "no", "y", "n", "1", "0"],
        match: "exact",
        inputLength: 14,
      });
    }
  });
  describe("match: extract", () => {
    it("extracts a boolean value from surrounding text", () => {
      const parser = new BooleanParser({ match: "extract" });
      expect(parser.parse("The answer is true.")).toEqual(true);
      expect(parser.parse("Decision: no.")).toEqual(false);
    });
    it("deduplicates equivalent boolean values", () => {
      const parser = new BooleanParser({ match: "extract" });
      expect(parser.parse("yes, true, and 1")).toEqual(true);
      expect(parser.parse("no, false, and 0")).toEqual(false);
    });
    it("does not match boolean tokens inside larger words", () => {
      const parser = new BooleanParser({ match: "extract" });
      try {
        parser.parse("Yesterday is not an answer.");
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).context).toMatchObject({
          reason: "unrecognized_boolean",
          match: "extract",
        });
      }
    });
    it("throws for conflicting extracted boolean values", () => {
      const parser = new BooleanParser({ match: "extract" });
      try {
        parser.parse("true and false");
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).context).toMatchObject({
          reason: "ambiguous_boolean",
          expected: "one boolean value",
          match: "extract",
          matchCount: 2,
        });
      }
    });
  });
  it("does not include input excerpts in error context by default", () => {
    const parser = new BooleanParser();
    try {
      parser.parse("sensitive output");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).not.toHaveProperty("inputExcerpt");
    }
  });
  it("includes a bounded input excerpt when debug mode is enabled", () => {
    process.env.LLM_EXE_DEBUG = "true";
    const parser = new BooleanParser();
    const input = "x".repeat(600);
    try {
      parser.parse(input);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        inputLength: 600,
        inputExcerpt: "x".repeat(500),
        inputExcerptTruncated: true,
      });
    }
  });
  it("includes an untruncated input excerpt when debug mode is enabled for short input", () => {
    process.env.LLM_EXE_DEBUG = "true";
    const parser = new BooleanParser();
    try {
      parser.parse("maybe");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        inputLength: 5,
        inputExcerpt: "maybe",
        inputExcerptTruncated: false,
      });
    }
  });
  it("throws parser.invalid_input for runtime boolean input", () => {
    const parser = new BooleanParser();
    try {
      // @ts-expect-error runtime contract: parser rejects non-string input.
      parser.parse(true);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.invalid_input");
      expect((e as LlmExeError).context).toEqual({
        operation: "BooleanParser.parse",
        parser: "boolean",
        reason: "invalid_input_type",
        expected: "string",
        received: "boolean",
      });
    }
  });
  it("throws parser.parse_failed for null input", () => {
    const parser = new BooleanParser();
    expect(() => {
      // @ts-expect-error runtime contract: parser rejects null input.
      parser.parse(null);
    }).toThrow(LlmExeError);
  });
  it("throws parser.parse_failed for undefined input", () => {
    const parser = new BooleanParser();
    expect(() => {
      // @ts-expect-error runtime contract: parser rejects undefined input.
      parser.parse(undefined);
    }).toThrow(LlmExeError);
  });
});
