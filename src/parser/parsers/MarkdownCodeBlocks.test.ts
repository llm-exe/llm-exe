import { BaseParser, MarkdownCodeBlocksParser } from "@/parser";

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

  it("handles stringified JSON input", () => {
    const parser = new MarkdownCodeBlocksParser();
    const code = `const data = { x: 1 };
`;
    const language = `javascript`;
    const markdown = `\`\`\`${language}\n${code}\`\`\``;
    
    // Create a stringified object with the markdown content
    const jsonInput = JSON.stringify({ result: markdown });
    
    expect(parser.parse(jsonInput)).toEqual([
      { code, language },
    ]);
  });

  it("handles stringified JSON with multiple code blocks", () => {
    const parser = new MarkdownCodeBlocksParser();
    const code1 = `const x = 1;
`;
    const code2 = `const y = 2;
`;
    const markdown = `Here's code:\n\`\`\`js\n${code1}\`\`\`\n\nMore code:\n\`\`\`python\n${code2}\`\`\``;

    // Create a stringified object
    const jsonInput = JSON.stringify({ response: markdown });

    expect(parser.parse(jsonInput)).toEqual([
      { code: code1, language: "js" },
      { code: code2, language: "python" },
    ]);
  });

  describe("edge cases", () => {
    it("captures a code block with no language as empty string", () => {
      const parser = new MarkdownCodeBlocksParser();
      const markdown = "```\nplain content\n```";
      expect(parser.parse(markdown)).toEqual([
        { language: "", code: "plain content\n" },
      ]);
    });

    it("captures an empty code block", () => {
      const parser = new MarkdownCodeBlocksParser();
      const markdown = "```js\n```";
      expect(parser.parse(markdown)).toEqual([{ language: "js", code: "" }]);
    });

    it("captures code blocks surrounded by prose without picking up the prose", () => {
      const parser = new MarkdownCodeBlocksParser();
      const markdown =
        "Here is some intro text.\n```ts\nconst x = 1;\n```\nAnd some trailing text.";
      expect(parser.parse(markdown)).toEqual([
        { language: "ts", code: "const x = 1;\n" },
      ]);
    });

    it("returns empty array for empty input", () => {
      const parser = new MarkdownCodeBlocksParser();
      expect(parser.parse("")).toEqual([]);
    });

    it("returns empty array for an unclosed code block", () => {
      const parser = new MarkdownCodeBlocksParser();
      // No closing ```, so the regex doesn't match
      const markdown = "```js\nconst x = 1;\n";
      expect(parser.parse(markdown)).toEqual([]);
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
  });
});
