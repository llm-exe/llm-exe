import { BaseParser, ReplaceStringTemplateParser } from "@/parser";
import { LlmExeError } from "@/errors";

/**
 * Tests the ReplaceStringTemplateParser class
 */
describe("llm-exe:parser/ReplaceStringTemplateParser", () => {
  it("creates class with expected properties", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(ReplaceStringTemplateParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("replaceStringTemplate");
  });

  it("replaces a single placeholder with provided value", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser.parse(`{{ replaceMe }}`, { replaceMe: "Hello World" })).toEqual(
      "Hello World"
    );
  });

  it("replaces multiple placeholders in the same template", () => {
    const parser = new ReplaceStringTemplateParser();
    const result = parser.parse(`Hello {{ name }}, you are {{ age }}`, {
      name: "Ada",
      age: 36,
    });
    expect(result).toEqual("Hello Ada, you are 36");
  });

  it("returns empty template exactly", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser.parse("")).toEqual("");
  });

  it("returns whitespace template exactly", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser.parse("   ")).toEqual("   ");
  });

  it("returns templates unchanged when no attributes are provided", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser.parse(`Hello {{ name }}!`)).toEqual("Hello !");
  });

  it("renders missing variables as empty strings without throwing", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser.parse(`Hello {{ name }}`, { other: "value" })).toEqual(
      "Hello "
    );
  });

  it("supports conditional blocks", () => {
    const parser = new ReplaceStringTemplateParser();
    const tmpl = `{{#if loggedIn}}Welcome back{{else}}Please sign in{{/if}}`;
    expect(parser.parse(tmpl, { loggedIn: true })).toEqual("Welcome back");
    expect(parser.parse(tmpl, { loggedIn: false })).toEqual("Please sign in");
  });

  it("supports each blocks over arrays", () => {
    const parser = new ReplaceStringTemplateParser();
    const tmpl = `{{#each items}}-{{this}}{{/each}}`;
    expect(parser.parse(tmpl, { items: ["a", "b", "c"] })).toEqual("-a-b-c");
  });

  it("supports nested object access via dot notation", () => {
    const parser = new ReplaceStringTemplateParser();
    expect(parser.parse(`{{ user.name }}`, { user: { name: "Grace" } })).toEqual(
      "Grace"
    );
  });

  it("does not mutate the substitutions object", () => {
    const parser = new ReplaceStringTemplateParser();
    const subs = { name: "Ada" };
    parser.parse(`Hello {{ name }}`, subs);
    expect(subs).toEqual({ name: "Ada" });
  });

  it("escapes HTML by default to prevent injection", () => {
    const parser = new ReplaceStringTemplateParser();
    const result = parser.parse(`{{ html }}`, {
      html: "<script>alert('x')</script>",
    });
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("emits raw output when using triple-stache", () => {
    const parser = new ReplaceStringTemplateParser();
    const result = parser.parse(`{{{ html }}}`, { html: "<b>bold</b>" });
    expect(result).toEqual("<b>bold</b>");
  });

  it("throws parser.invalid_input for invalid input type", () => {
    const parser = new ReplaceStringTemplateParser();
    try {
      parser.parse(null as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.invalid_input");
      expect((e as LlmExeError).context).toEqual({
        operation: "ReplaceStringTemplateParser.parse",
        parser: "replaceStringTemplate",
        reason: "invalid_input_type",
        expected: "string",
        received: "null",
      });
    }
  });

  it("describes array invalid input type in parser context", () => {
    const parser = new ReplaceStringTemplateParser();
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

  it("describes number invalid input type in parser context", () => {
    const parser = new ReplaceStringTemplateParser();
    try {
      parser.parse(42 as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "number",
      });
    }
  });

  it("throws parser.invalid_input for invalid attributes", () => {
    const parser = new ReplaceStringTemplateParser();
    try {
      parser.parse("Hello {{ name }}", null as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.invalid_input");
      expect((e as LlmExeError).context).toEqual({
        operation: "ReplaceStringTemplateParser.parse",
        parser: "replaceStringTemplate",
        reason: "invalid_attributes",
        expected: "object",
        received: "null",
      });
    }
  });

  it("describes array invalid attributes in parser context", () => {
    const parser = new ReplaceStringTemplateParser();
    try {
      parser.parse("Hello {{ name }}", [] as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_attributes",
        received: "array",
      });
    }
  });

  it("describes primitive invalid attributes in parser context", () => {
    const parser = new ReplaceStringTemplateParser();
    try {
      parser.parse("Hello {{ name }}", "Greg" as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_attributes",
        received: "string",
      });
    }
  });

  it("wraps template replacement failures in parser.parse_failed", () => {
    const parser = new ReplaceStringTemplateParser();
    try {
      parser.parse("Hello {{#if name}}");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ReplaceStringTemplateParser.parse",
        parser: "replaceStringTemplate",
        reason: "template_replacement_failed",
        inputLength: 18,
      });
      expect((e as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
    }
  });
});
