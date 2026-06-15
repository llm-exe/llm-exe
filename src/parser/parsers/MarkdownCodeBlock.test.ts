import { BaseParser, MarkdownCodeBlockParser } from "@/parser";

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

  it("returns correct structure if nothing found", () => {
    const parser = new MarkdownCodeBlockParser();
    const markdown = `nothing here`;
    expect(parser.parse(markdown)).toEqual({ code: "", language: "" });
  });

  describe("edge cases", () => {
    it("returns the first code block when multiple are present", () => {
      const parser = new MarkdownCodeBlockParser();
      const markdown = "```ts\nfirst;\n```\n```py\nsecond\n```";
      expect(parser.parse(markdown)).toEqual({ language: "ts", code: "first;\n" });
    });

    it("returns empty {code, language} for empty input", () => {
      const parser = new MarkdownCodeBlockParser();
      expect(parser.parse("")).toEqual({ code: "", language: "" });
    });

    it("returns empty {code, language} for an unclosed code block", () => {
      const parser = new MarkdownCodeBlockParser();
      expect(parser.parse("```ts\nno closer here")).toEqual({
        code: "",
        language: "",
      });
    });
  });
});
