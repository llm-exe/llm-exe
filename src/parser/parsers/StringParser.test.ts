import { BaseParser, StringParser } from "@/parser";
import { LlmExeError } from "@/errors";
import { OutputResult } from "@/types";

function assertStringParserInputTypes(parser: StringParser, output: OutputResult) {
  // @ts-expect-error StringParser only accepts string input at compile time.
  parser.parse(output);
}
void assertStringParserInputTypes;

/**
 * Tests the StringParser class
 */
describe("llm-exe:parser/StringParser", () => {
  it('creates class with expected properties', () => {
    const parser = new StringParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(StringParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("string")
  })
  it('parses simple string correctly', () => {
    const parser = new StringParser()
    expect(parser.parse("Hello")).toEqual("Hello")
  })
  it('returns empty string exactly', () => {
    const parser = new StringParser()
    expect(parser.parse("")).toEqual("")
  })
  it('returns whitespace-only string exactly', () => {
    const parser = new StringParser()
    expect(parser.parse("   ")).toEqual("   ")
  })
  it('returns multiline string exactly', () => {
    const parser = new StringParser()
    expect(parser.parse("a\nb")).toEqual("a\nb")
  })
  it('throws parser.invalid_input for array input', () => {
    const parser = new StringParser();
    const badValue = ["Hello"] as unknown as string;
    try {
      parser.parse(badValue)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.invalid_input")
      expect((e as LlmExeError).context).toEqual({
        operation: "StringParser.parse",
        parser: "string",
        reason: "invalid_input_type",
        expected: "string",
        received: "array",
      })
    }
  })
  it('throws parser.invalid_input for object input', () => {
    const parser = new StringParser();
    const badValue = {hello: "world"} as unknown as string;
    try {
      parser.parse(badValue)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.invalid_input")
      expect((e as LlmExeError).context).toEqual({
        operation: "StringParser.parse",
        parser: "string",
        reason: "invalid_input_type",
        expected: "string",
        received: "object",
      })
    }
  })
  it('throws parser.parse_failed for null input', () => {
    const parser = new StringParser();
    expect(() => parser.parse(null as any)).toThrow(LlmExeError)
  })
  it('throws parser.parse_failed for OutputResult input', () => {
    const parser = new StringParser();
    const outputResult = {
      id: "test",
      created: 0,
      stopReason: "stop",
      content: [{ type: "text", text: "Hello" }],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
    try {
      parser.parse(outputResult as any)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toEqual({
        operation: "StringParser.parse",
        parser: "string",
        reason: "invalid_input_type",
        expected: "string",
        received: "object",
      })
    }
  })
});
