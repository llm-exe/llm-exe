import { BaseParser, MarkdownCodeBlockParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the MarkdownCodeBlock class
 */
describe("llm-exe:parser/MarkdownCodeBlock", () => {
  it("creates class with expected properties", () => {
    const parser = new MarkdownCodeBlockParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(MarkdownCodeBlockParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("markdownCodeBlock");
  });
  it("parses simple string correctly", () => {
    const parser = new MarkdownCodeBlockParser();
    const code = `const input = "test";\n`;
    const language = `typescript`;
    const markdown = `\`\`\`${language}\n${code}\`\`\``;

    expect(parser.parse(markdown)).toEqual({ code, language });
  });

  it("throws parser.parse_failed if nothing found", () => {
    const parser = new MarkdownCodeBlockParser();
    const markdown = `nothing here`;
    try {
      parser.parse(markdown)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toEqual({
        operation: "MarkdownCodeBlockParser.parse",
        parser: "markdownCodeBlock",
        reason: "no_code_block",
        inputLength: 12,
      })
    }
  });
  it("parses untyped block with empty language", () => {
    const parser = new MarkdownCodeBlockParser();
    expect(parser.parse("```\ntext\n```")).toEqual({
      code: "text\n",
      language: "",
    });
  });
  it("throws parser.parse_failed for multiple blocks", () => {
    const parser = new MarkdownCodeBlockParser();
    const markdown = "```ts\nx\n```\n```js\ny\n```";
    try {
      parser.parse(markdown)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toEqual({
        operation: "MarkdownCodeBlockParser.parse",
        parser: "markdownCodeBlock",
        reason: "multiple_code_blocks",
        inputLength: 23,
        matchCount: 2,
      })
    }
  });
  it("throws parser.parse_failed for empty input", () => {
    const parser = new MarkdownCodeBlockParser();
    expect(() => parser.parse("")).toThrow(LlmExeError);
  });
  it("throws parser.parse_failed for malformed fences", () => {
    const parser = new MarkdownCodeBlockParser();
    expect(() => parser.parse("```ts\nconst x = 1;")).toThrow(LlmExeError);
  });
  it("throws parser.parse_failed for invalid input type", () => {
    const parser = new MarkdownCodeBlockParser();
    expect(() => {
      // @ts-expect-error runtime contract: parser rejects null input.
      parser.parse(null)
    }).toThrow(LlmExeError);
  });
  it("describes array invalid input type in parser context", () => {
    const parser = new MarkdownCodeBlockParser();
    try {
      // @ts-expect-error runtime contract: parser rejects array input.
      parser.parse([])
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "array",
      })
    }
  });
  it("describes object invalid input type in parser context", () => {
    const parser = new MarkdownCodeBlockParser();
    try {
      // @ts-expect-error runtime contract: parser rejects object input.
      parser.parse({})
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "object",
      })
    }
  });

  describe("edge cases", () => {
    it("throws when multiple code blocks are present", () => {
      const parser = new MarkdownCodeBlockParser();
      const markdown = "```ts\nfirst;\n```\n```py\nsecond\n```";
      expect(() => parser.parse(markdown)).toThrow(LlmExeError);
    });

    it("throws for empty input", () => {
      const parser = new MarkdownCodeBlockParser();
      expect(() => parser.parse("")).toThrow(LlmExeError);
    });

    it("throws for an unclosed code block", () => {
      const parser = new MarkdownCodeBlockParser();
      expect(() => parser.parse("```ts\nno closer here")).toThrow(LlmExeError);
    });
  });
});
