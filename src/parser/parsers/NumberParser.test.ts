import { BaseParser, NumberParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the NumberParser class
 */
describe("llm-exe:parser/NumberParser", () => {
  it("creates class with expected properties", () => {
    const parser = new NumberParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(NumberParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("number");
  });
  it("parses simple string correctly", () => {
    const parser = new NumberParser();
    expect(parser.parse("1")).toEqual(1);
  });
  it("parses multi-digit numbers", () => {
    const parser = new NumberParser();
    expect(parser.parse("42")).toEqual(42);
    expect(parser.parse("100")).toEqual(100);
    expect(parser.parse("1234567")).toEqual(1234567);
  });
  it("parses decimal numbers", () => {
    const parser = new NumberParser();
    expect(parser.parse("3.14")).toEqual(3.14);
    expect(parser.parse("0.5")).toEqual(0.5);
  });
  it("parses comma numbers", () => {
    const parser = new NumberParser();
    expect(parser.parse("1,000")).toEqual(1000);
    expect(parser.parse("1,234,567")).toEqual(1234567);
  });
  it("parses scientific notation", () => {
    const parser = new NumberParser();
    expect(parser.parse("1e3")).toEqual(1000);
    expect(parser.parse("-2.5e2")).toEqual(-250);
    expect(parser.parse("1.5e10")).toEqual(15000000000);
  });
  it("parses leading decimals", () => {
    const parser = new NumberParser();
    expect(parser.parse(".5")).toEqual(0.5);
    expect(parser.parse("-.25")).toEqual(-0.25);
  });
  it("parses negative numbers", () => {
    const parser = new NumberParser();
    expect(parser.parse("-7")).toEqual(-7);
    expect(parser.parse("-3.14")).toEqual(-3.14);
    expect(parser.parse("-1")).toEqual(-1);
  });
  it("parses negative one from surrounding text", () => {
    const parser = new NumberParser();
    expect(parser.parse("the answer is -1")).toEqual(-1);
  });
  it("extracts number from surrounding text", () => {
    const parser = new NumberParser();
    expect(parser.parse("The answer is 42.")).toEqual(42);
    expect(parser.parse("Score: 99 points")).toEqual(99);
  });
  it("throws LlmExeError if no number found", () => {
    const parser = new NumberParser();
    expect(() => parser.parse("No Number")).toThrow(LlmExeError);
  });
  it("throws LlmExeError with parser error code when no number found", () => {
    const parser = new NumberParser();
    try {
      parser.parse("not a number");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "NumberParser.parse",
        parser: "number",
        reason: "no_numeric_value",
        expected: "number",
        match: "extract",
        inputLength: 12,
      });
    }
  });
  it("throws parser.parse_failed for empty input", () => {
    const parser = new NumberParser();
    try {
      parser.parse("");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "NumberParser.parse",
        parser: "number",
        reason: "empty_input",
        expected: "number",
        inputLength: 0,
      });
    }
  });
  it("throws parser.parse_failed for whitespace-only input", () => {
    const parser = new NumberParser();
    expect(() => parser.parse("   ")).toThrow(LlmExeError);
  });
  it("throws parser.parse_failed for multiple numbers", () => {
    const parser = new NumberParser();
    try {
      parser.parse("from 1 to 10");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "NumberParser.parse",
        parser: "number",
        reason: "ambiguous_number",
        expected: "one numeric value",
        match: "extract",
        inputLength: 12,
        matchCount: 2,
      });
    }
  });
  it("rejects Indian-style comma grouping instead of partially parsing it", () => {
    const parser = new NumberParser();
    try {
      parser.parse("1,00,000");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "no_numeric_value",
        match: "extract",
      });
    }
  });
  it("throws parser.parse_failed for runtime number input", () => {
    const parser = new NumberParser();
    try {
      // @ts-expect-error runtime contract: parser rejects non-string input.
      parser.parse(42);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "NumberParser.parse",
        parser: "number",
        reason: "invalid_input_type",
        expected: "string",
        received: "number",
      });
    }
  });
  it("throws parser.parse_failed for null input", () => {
    const parser = new NumberParser();
    expect(() => {
      // @ts-expect-error runtime contract: parser rejects null input.
      parser.parse(null);
    }).toThrow(LlmExeError);
  });
  it("describes array invalid input type in parser context", () => {
    const parser = new NumberParser();
    try {
      // @ts-expect-error runtime contract: parser rejects array input.
      parser.parse([]);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        operation: "NumberParser.parse",
        parser: "number",
        reason: "invalid_input_type",
        received: "array",
      });
    }
  });

  describe("multi-number text (locks in first-match semantics)", () => {
    it("returns the first number when multiple are present", () => {
      const parser = new NumberParser();
      expect(parser.parse("first 7, then 12, then 99")).toEqual(7);
    });

    it("returns the first decimal when multiple decimals are present", () => {
      const parser = new NumberParser();
      expect(parser.parse("price 3.14 sale 9.99")).toEqual(3.14);
    });

    it("matches a negative number embedded in text", () => {
      const parser = new NumberParser();
      expect(parser.parse("temperature was -5 degrees")).toEqual(-5);
    });

    it("returns the integer part when followed by trailing dot but no decimal digits", () => {
      // The regex requires \d+ after the dot, so "5." matches as just 5
      const parser = new NumberParser();
      expect(parser.parse("Total: 5.")).toEqual(5);
    });
  });

  describe("edge cases (locks in current regex behavior)", () => {
    it("ignores leading plus sign and matches digits only", () => {
      // The regex /-?\d+(\.\d+)?/ has no `+?` so a plus prefix is dropped.
      const parser = new NumberParser();
      expect(parser.parse("+42")).toEqual(42);
    });

    it("does not parse scientific notation as a single number", () => {
      // The regex doesn't include the 'e' exponent, so "1e5" extracts just 1.
      const parser = new NumberParser();
      expect(parser.parse("answer is 1e5")).toEqual(1);
    });

    it("throws on empty string input", () => {
      const parser = new NumberParser();
      expect(() => parser.parse("")).toThrow(LlmExeError);
    });

    it("throws on whitespace-only input", () => {
      const parser = new NumberParser();
      expect(() => parser.parse("   \n\t   ")).toThrow(LlmExeError);
    });

    it("handles zero correctly", () => {
      const parser = new NumberParser();
      expect(parser.parse("0")).toEqual(0);
      expect(parser.parse("the value is 0 today")).toEqual(0);
    });

    it("handles negative zero as -0 (Object.is distinct, equal-by-numeric)", () => {
      // The regex captures "-0" and toNumber preserves the sign,
      // so the parser returns -0 (not +0). Use Object.is to verify.
      const parser = new NumberParser();
      const result = parser.parse("-0");
      expect(result).toBe(-0);
      expect(Object.is(result, -0)).toBe(true);
    });

    it("preserves precision for decimals", () => {
      const parser = new NumberParser();
      expect(parser.parse("0.00001")).toEqual(0.00001);
      expect(parser.parse("1234.5678")).toEqual(1234.5678);
    });

    it("matches a negative number even when prefixed by a non-digit hyphen pattern", () => {
      // "answer--5" — first hyphen sits before another hyphen+digit.
      // regex finds the second `-5` token.
      const parser = new NumberParser();
      expect(parser.parse("answer--5 not 3")).toEqual(-5);
    });
  });
});

describe("match: exact", () => {
  it("accepts a bare integer", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(parser.parse("42")).toEqual(42);
  });
  it("accepts a bare decimal", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(parser.parse("3.14")).toEqual(3.14);
  });
  it("accepts a comma-grouped number", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(parser.parse("1,000")).toEqual(1000);
  });
  it("accepts a value after trim", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(parser.parse("  42  ")).toEqual(42);
  });
  it("rejects a number embedded in prose", () => {
    const parser = new NumberParser({ match: "exact" });
    try {
      parser.parse("The answer is 42.");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "no_numeric_value",
        match: "exact",
      });
    }
  });
  it("rejects multiple numbers", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(() => parser.parse("1 2")).toThrow(LlmExeError);
  });
  it("rejects currency and unit text", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(() => parser.parse("$5")).toThrow(LlmExeError);
    expect(() => parser.parse("5 dollars")).toThrow(LlmExeError);
  });
  it("rejects invalid comma grouping", () => {
    const parser = new NumberParser({ match: "exact" });
    expect(() => parser.parse("1,00,000")).toThrow(LlmExeError);
  });
});
