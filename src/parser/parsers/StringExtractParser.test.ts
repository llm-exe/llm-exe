import { BaseParser, StringExtractParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the StringExtractParser class
 */
describe("llm-exe:parser/StringExtractParser", () => {
  it("creates class with expected properties", () => {
    const parser = new StringExtractParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(StringExtractParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("stringExtract");
  });

  it("matches enum value at word boundary (default mode)", () => {
    const parser = new StringExtractParser({ enum: ["Hello"] });
    expect(parser.parse("Hello!!")).toEqual("Hello");
  });

  it("extracts enum value from surrounding prose", () => {
    const parser = new StringExtractParser({ enum: ["yes", "no"] });
    expect(parser.parse("No, that's right")).toEqual("no");
  });

  it("does not match substrings of larger words by default", () => {
    const parser = new StringExtractParser({ enum: ["no"] });
    try {
      parser.parse("nope");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "StringExtractParser.parse",
        parser: "stringExtract",
        reason: "no_enum_match",
        expected: ["no"],
        match: "word",
        inputLength: 4,
      });
    }
  });

  it("word mode rejects configured values embedded inside larger words", () => {
    const parser = new StringExtractParser({ enum: ["yes"] });
    expect(() => parser.parse("ayesha")).toThrow(LlmExeError);
  });

  it("does not match substrings of larger numbers by default", () => {
    const parser = new StringExtractParser({ enum: ["1"] });
    expect(() => parser.parse("12")).toThrow(LlmExeError);
  });

  it("defaults ignoreCase to true", () => {
    const parser = new StringExtractParser({ enum: ["Hello"] });
    expect(parser.parse("hello")).toEqual("Hello");
    expect(parser.parse("hElLo")).toEqual("Hello");
  });

  it("respects ignoreCase: false", () => {
    const parser = new StringExtractParser({
      enum: ["Hello"],
      ignoreCase: false,
    });
    expect(() => parser.parse("hello")).toThrow(LlmExeError);
  });

  it("throws LlmExeError when no enum value matches", () => {
    const parser = new StringExtractParser({ enum: ["Hello"] });
    expect(() => parser.parse("Yo!!")).toThrow(LlmExeError);
    expect(() => parser.parse("Yo!!")).toThrow(
      "No matching enum value found in input."
    );
  });

  it("throws for array input", () => {
    const parser = new StringExtractParser({ enum: ["Hello"] });
    const badValue = ["Hello"] as unknown as string;
    expect(() => parser.parse(badValue)).toThrow(
      "Invalid input. Expected string. Received array."
    );
  });

  it("throws for null input", () => {
    const parser = new StringExtractParser({ enum: ["Hello"] });
    expect(() => parser.parse(null as any)).toThrow(
      "Invalid input. Expected string. Received null."
    );
  });

  it("throws for object input", () => {
    const parser = new StringExtractParser({ enum: ["Hello"] });
    const badValue = { hello: "world" } as unknown as string;
    expect(() => parser.parse(badValue)).toThrow(
      "Invalid input. Expected string. Received object."
    );
  });

  it("throws parser.parse_failed with structured context on no match", () => {
    const parser = new StringExtractParser({ enum: ["yes", "no"] });
    try {
      parser.parse("The answer is maybe");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "StringExtractParser.parse",
        parser: "stringExtract",
        reason: "no_enum_match",
        expected: ["yes", "no"],
        match: "word",
        inputLength: 19,
      });
    }
  });

  it("throws parser.parse_failed for empty input", () => {
    const parser = new StringExtractParser({ enum: ["yes", "no"] });
    try {
      parser.parse("");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "StringExtractParser.parse",
        parser: "stringExtract",
        reason: "empty_input",
        expected: ["yes", "no"],
        inputLength: 0,
      });
    }
  });

  it("returns empty string when explicitly configured and input is empty", () => {
    const parser = new StringExtractParser({ enum: [""] });
    expect(parser.parse("")).toEqual("");
  });

  it("throws when no enum values are provided and input is given", () => {
    const parser = new StringExtractParser();
    try {
      parser.parse("anything");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "StringExtractParser.parse",
        parser: "stringExtract",
        reason: "no_enum_values",
        expected: "non-empty enum",
        inputLength: 8,
      });
    }
  });

  it("no enum values wins over empty input", () => {
    const parser = new StringExtractParser({ enum: [] });
    try {
      parser.parse("");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "no_enum_values",
      });
    }
  });

  it("treats regex metacharacters as literal strings", () => {
    const parser = new StringExtractParser({ enum: ["C++", "a.b"] });
    expect(parser.parse("Language: C++")).toEqual("C++");
    expect(() => parser.parse("value acb")).toThrow(LlmExeError);
  });

  it("does not treat prefix overlap as ambiguous in word mode", () => {
    const parser = new StringExtractParser({ enum: ["cat", "caterpillar"] });
    expect(parser.parse("caterpillar")).toEqual("caterpillar");
    expect(parser.parse("the cat sat")).toEqual("cat");
  });

  it("throws ambiguous when multiple values match as independent words", () => {
    const parser = new StringExtractParser({ enum: ["yes", "no"] });
    try {
      parser.parse("yes and no");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "StringExtractParser.parse",
        parser: "stringExtract",
        reason: "ambiguous_enum_match",
        expected: ["yes", "no"],
        match: "word",
        inputLength: 10,
        matchCount: 2,
      });
    }
  });

  it("deduplicates repeated matches of the same enum value", () => {
    const parser = new StringExtractParser({ enum: ["yes"] });
    expect(parser.parse("yes, yes, yes")).toEqual("yes");
  });

  it("does not let empty enum value match non-empty input", () => {
    const parser = new StringExtractParser({ enum: ["", "yes"] });
    expect(parser.parse("yes")).toEqual("yes");
  });

  it("does not treat whitespace-only input as an empty string match", () => {
    const parser = new StringExtractParser({ enum: [""] });
    try {
      parser.parse("   ");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "no_enum_match",
        inputLength: 3,
      });
    }
  });

  it("uses unicode-aware word boundaries", () => {
    const parser = new StringExtractParser({ enum: ["café"] });
    expect(parser.parse("café!")).toEqual("café");
    expect(() => parser.parse("decaféinated")).toThrow(LlmExeError);
  });

  describe("match: substring (legacy opt-in)", () => {
    it("matches substrings of larger words", () => {
      const parser = new StringExtractParser({
        enum: ["no"],
        match: "substring",
      });
      expect(parser.parse("nope")).toEqual("no");
    });

    it("matches configured values inside unrelated words", () => {
      const parser = new StringExtractParser({
        enum: ["yes"],
        match: "substring",
      });
      expect(parser.parse("ayesha")).toEqual("yes");
    });

    it("respects ignoreCase: false in substring mode", () => {
      const parser = new StringExtractParser({
        enum: ["Yes"],
        match: "substring",
        ignoreCase: false,
      });
      expect(parser.parse("Say Yes")).toEqual("Yes");
      expect(() => parser.parse("say yes")).toThrow(LlmExeError);
    });

    it("does not let empty enum value match by substring", () => {
      const parser = new StringExtractParser({
        enum: ["", "yes"],
        match: "substring",
      });
      expect(parser.parse("yes")).toEqual("yes");
    });

    it("still throws when no enum value appears", () => {
      const parser = new StringExtractParser({
        enum: ["yes", "no"],
        match: "substring",
      });
      try {
        parser.parse("maybe");
        fail("Expected an error to be thrown");
      } catch (e) {
        expect((e as LlmExeError).context).toMatchObject({
          reason: "no_enum_match",
          match: "substring",
        });
      }
    });
  });

  describe("match: whole", () => {
    it("accepts input that equals the enum value", () => {
      const parser = new StringExtractParser({
        enum: ["yes", "no"],
        match: "whole",
      });
      expect(parser.parse("yes")).toEqual("yes");
    });

    it("accepts input after trimming whitespace", () => {
      const parser = new StringExtractParser({
        enum: ["yes"],
        match: "whole",
      });
      expect(parser.parse("  yes  ")).toEqual("yes");
    });

    it("rejects input that contains the value with extra content", () => {
      const parser = new StringExtractParser({
        enum: ["yes"],
        match: "whole",
      });
      try {
        parser.parse("yes please");
        fail("Expected an error to be thrown");
      } catch (e) {
        expect((e as LlmExeError).context).toMatchObject({
          reason: "no_enum_match",
          match: "whole",
        });
      }
    });

    it("does not let empty enum value match in whole mode", () => {
      const parser = new StringExtractParser({
        enum: ["", "yes"],
        match: "whole",
      });
      expect(parser.parse("yes")).toEqual("yes");
    });

    it("respects ignoreCase: false in whole mode", () => {
      const parser = new StringExtractParser({
        enum: ["Yes"],
        match: "whole",
        ignoreCase: false,
      });
      expect(parser.parse("Yes")).toEqual("Yes");
      expect(() => parser.parse("yes")).toThrow(LlmExeError);
    });
  });

  describe("multiple enum values and match priority", () => {
    it("throws parser.parse_failed when multiple enum values match in input", () => {
      const parser = new StringExtractParser({ enum: ["no", "yes"] });
      try {
        parser.parse("yes and no");
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toEqual("parser.parse_failed");
        expect((e as LlmExeError).context).toMatchObject({
          operation: "StringExtractParser.parse",
          parser: "stringExtract",
          reason: "ambiguous_enum_match",
        });
      }
    });

    it("matches case-insensitively by default", () => {
      const parser = new StringExtractParser({
        enum: ["Approve", "Reject"],
      });
      expect(parser.parse("Final decision: REJECT")).toEqual("Reject");
      expect(parser.parse("approve please")).toEqual("Approve");
    });

    it("throws when input does not contain any enum value (case-sensitive)", () => {
      const parser = new StringExtractParser({
        enum: ["Yes", "No"],
        ignoreCase: false,
      });
      // lowercase "yes" should not match capitalized "Yes" with ignoreCase: false
      expect(() => parser.parse("yes please")).toThrow(LlmExeError);
    });
  });

  describe("edge cases on input shape", () => {
    it("throws on null input with the expected type message", () => {
      const parser = new StringExtractParser({ enum: ["a"] });
      const badValue = null as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received null."
      );
    });

    it('throws on undefined input', () => {
      const parser = new StringExtractParser({ enum: ["a"] });
      const badValue = undefined as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received undefined."
      );
    });

    it('throws on number input', () => {
      const parser = new StringExtractParser({ enum: ["a"] });
      const badValue = 42 as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received number."
      );
    });

    it('throws on empty input when enum values exist', () => {
      const parser = new StringExtractParser({ enum: ["yes"] });
      expect(() => parser.parse("")).toThrow(LlmExeError);
    });
  });

  describe("word-boundary matching (v3 default)", () => {
    it("does not match an enum value that appears inside a longer word", () => {
      const parser = new StringExtractParser({ enum: ["yes"] });
      // "yes" inside "yesterday" should not match in default word mode
      expect(() => parser.parse("yesterday is over")).toThrow(LlmExeError);
    });

    it("matches as a substring when match: 'substring' is opted into", () => {
      const parser = new StringExtractParser({
        enum: ["yes"],
        match: "substring",
      });
      expect(parser.parse("yesterday is over")).toEqual("yes");
    });

    it("escapes regex metacharacters in enum entries", () => {
      // "a.b" should be matched literally; the dot is NOT a regex wildcard
      const parser = new StringExtractParser({ enum: ["a.b"] });
      expect(() => parser.parse("axb")).toThrow(LlmExeError);
      expect(parser.parse("a.b")).toEqual("a.b");
    });
  });
});
