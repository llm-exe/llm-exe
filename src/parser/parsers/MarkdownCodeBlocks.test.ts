import { BaseParser, MarkdownCodeBlocksParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the MarkdownCodeBlock class
 */
describe("llm-exe:parser/MarkdownCodeBlocks", () => {
  it("creates class with expected properties", () => {
    const parser = new MarkdownCodeBlocksParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(MarkdownCodeBlocksParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("markdownCodeBlocks");
  });

  it("parses simple string correctly", () => {
    const parser = new MarkdownCodeBlocksParser();
    const code = `const input = "test";\n`;
    const language = `typescript`;
    const markdown = `\`\`\`${language}\n${code}\`\`\``;

    expect(parser.parse(`${markdown}\n\n${markdown}`)).toEqual([
      { code, language },
      { code, language },
    ]);
  });

  it("returns correct structure if nothing found", () => {
    const parser = new MarkdownCodeBlocksParser();
    const markdown = `nothing here`;
    expect(parser.parse(markdown)).toEqual([]);
  });

  it("does not unwrap stringified JSON input", () => {
    const parser = new MarkdownCodeBlocksParser();
    const code = `const data = { x: 1 };
`;
    const language = `javascript`;
    const markdown = `\`\`\`${language}\n${code}\`\`\``;

    const jsonInput = JSON.stringify({ result: markdown });

    expect(parser.parse(jsonInput)).toEqual([]);
  });

  it("does not unwrap stringified JSON with multiple code blocks", () => {
    const parser = new MarkdownCodeBlocksParser();
    const code1 = `const x = 1;
`;
    const code2 = `const y = 2;
`;
    const markdown = `Here's code:\n\`\`\`js\n${code1}\`\`\`\n\nMore code:\n\`\`\`python\n${code2}\`\`\``;

    const jsonInput = JSON.stringify({ response: markdown });

    expect(parser.parse(jsonInput)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    const parser = new MarkdownCodeBlocksParser();
    expect(parser.parse("")).toEqual([]);
  });

  it("parses an untyped fence with empty language", () => {
    const parser = new MarkdownCodeBlocksParser();
    expect(parser.parse("```\nplain\n```")).toEqual([
      { code: "plain\n", language: "" },
    ]);
  });

  it("captures an empty code block", () => {
    const parser = new MarkdownCodeBlocksParser();
    expect(parser.parse("```js\n```")).toEqual([{ language: "js", code: "" }]);
  });

  it("captures code blocks surrounded by prose without picking up the prose", () => {
    const parser = new MarkdownCodeBlocksParser();
    const markdown =
      "Here is some intro text.\n```ts\nconst x = 1;\n```\nAnd some trailing text.";
    expect(parser.parse(markdown)).toEqual([
      { language: "ts", code: "const x = 1;\n" },
    ]);
  });

  it("captures a code block at end-of-string only when closed", () => {
    const parser = new MarkdownCodeBlocksParser();
    const closed = "```js\nconst x = 1;\n```";
    expect(parser.parse(closed)).toEqual([
      { language: "js", code: "const x = 1;\n" },
    ]);
  });

  it("captures code blocks with content containing backticks (single, double)", () => {
    const parser = new MarkdownCodeBlocksParser();
    const markdown = "```md\nUse `inline` or ``backticks`` here\n```";
    expect(parser.parse(markdown)).toEqual([
      { language: "md", code: "Use `inline` or ``backticks`` here\n" },
    ]);
  });

  it("throws parser.parse_failed for malformed fences", () => {
    const parser = new MarkdownCodeBlocksParser();
    try {
      parser.parse("```ts\nconst x = 1;");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "MarkdownCodeBlocksParser.parse",
        parser: "markdownCodeBlocks",
        reason: "malformed_code_block",
        inputLength: 18,
      });
    }
  });

  it("throws parser.parse_failed for invalid input type", () => {
    const parser = new MarkdownCodeBlocksParser();
    try {
      parser.parse(null as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "MarkdownCodeBlocksParser.parse",
        parser: "markdownCodeBlocks",
        reason: "invalid_input_type",
        expected: "string",
        received: "null",
      });
    }
  });

  it("describes array invalid input type in parser context", () => {
    const parser = new MarkdownCodeBlocksParser();
    try {
      parser.parse([] as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "array",
      });
    }
  });

  it("describes object invalid input type in parser context", () => {
    const parser = new MarkdownCodeBlocksParser();
    try {
      parser.parse({} as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "object",
      });
    }
  });
});
