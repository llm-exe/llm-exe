import { BaseParser, StringExtractParser } from "@/parser";
import { LlmExeError } from "@/utils/modules/errors";

/**
 * Tests the StringExtractParser class
 */
describe("llm-exe:parser/StringExtractParser", () => {
  it('creates class with expected properties', () => {
    const parser = new StringExtractParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(StringExtractParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("stringExtract")
  })
  it('parses simple string correctly', () => {
    const parser = new StringExtractParser({enum: ["Hello"]})
    expect(parser.parse("Hello!!")).toEqual("Hello")
  })
  it('throws LlmExeError when no enum value matches', () => {
    const parser = new StringExtractParser({enum: ["Hello"]})
    expect(() => parser.parse("Yo!!")).toThrow(LlmExeError)
    expect(() => parser.parse("Yo!!")).toThrow("No matching enum value found in input.")
  })
  it('parses simple string correctly with options.ignoreCase', () => {
    const parser = new StringExtractParser({enum: ["Hello"], ignoreCase: true})
    expect(parser.parse("hello")).toEqual("Hello")
    expect(parser.parse("hElLo")).toEqual("Hello")
  })
  it('parses array to string', () => {
    const parser = new StringExtractParser({enum: ["Hello"]});
    const badValue = ["Hello"] as unknown as string;
    expect(() => parser.parse(badValue)).toThrow("Invalid input. Expected string. Received object.")
  })
  it('parses object to string', () => {
    const parser = new StringExtractParser({enum: ["Hello"]});
    const badValue = {hello: "world"} as unknown as string;
    expect(() => parser.parse(badValue)).toThrow("Invalid input. Expected string. Received object.")
  });
  it('throws LlmExeError with parser error code when no match', () => {
    const parser = new StringExtractParser({enum: ["yes", "no"]})
    try {
      parser.parse("The answer is maybe");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser");
      expect((e as LlmExeError).context).toEqual({
        parser: "stringExtract",
        output: "The answer is maybe",
        error: "No matching enum value found in input. Expected one of: yes, no",
      });
    }
  });
  it('throws when no enum values are provided and input is given', () => {
    const parser = new StringExtractParser()
    expect(() => parser.parse("anything")).toThrow(LlmExeError)
  });

  describe("multiple enum values and match priority", () => {
    it('returns the first enum entry that matches (enum order, not text order)', () => {
      // "no" is listed first; even though "yes" also appears in input, "no" wins
      const parser = new StringExtractParser({ enum: ["no", "yes"] });
      expect(parser.parse("yes and no")).toEqual("no");
    });

    it('returns first enum entry case-insensitively when ignoreCase is set', () => {
      const parser = new StringExtractParser({
        enum: ["Approve", "Reject"],
        ignoreCase: true,
      });
      expect(parser.parse("Final decision: REJECT")).toEqual("Reject");
      expect(parser.parse("approve please")).toEqual("Approve");
    });

    it('throws when input does not contain any enum value (case-sensitive)', () => {
      const parser = new StringExtractParser({ enum: ["Yes", "No"] });
      // lowercase "yes" should not match capitalized "Yes" without ignoreCase
      expect(() => parser.parse("yes please")).toThrow(LlmExeError);
    });
  });

  describe("edge cases on input shape", () => {
    it('throws on null input with the expected type message', () => {
      const parser = new StringExtractParser({ enum: ["a"] });
      const badValue = null as unknown as string;
      expect(() => parser.parse(badValue)).toThrow(
        "Invalid input. Expected string. Received object."
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

  describe("partial match behavior (locks in current regex semantics)", () => {
    it('matches enum value as a substring (not whole-word)', () => {
      const parser = new StringExtractParser({ enum: ["yes"] });
      // "yes" appears inside "yesterday" — matches because the regex has no boundaries
      expect(parser.parse("yesterday is over")).toEqual("yes");
    });

    it('treats enum entries as raw regex source (not escaped)', () => {
      // The implementation passes the enum value straight into RegExp().
      // This documents that current behavior — special chars are treated as regex,
      // which is a footgun callers should be aware of.
      const parser = new StringExtractParser({ enum: ["a.b"] });
      // "a.b" as regex matches "axb" (dot = any char)
      expect(parser.parse("axb")).toEqual("a.b");
    });
  });
});

