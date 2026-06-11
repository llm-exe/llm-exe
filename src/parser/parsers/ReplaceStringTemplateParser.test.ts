
import { BaseParser, ReplaceStringTemplateParser } from "@/parser";

/**
 * Tests the ReplaceStringTemplateParser class
 */
describe("llm-exe:parser/ReplaceStringTemplateParser", () => {
  it('creates class with expected properties', () => {
    const parser = new ReplaceStringTemplateParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ReplaceStringTemplateParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("replaceStringTemplate")
  });

  it('replaces a single placeholder with provided value', () => {
    const parser = new ReplaceStringTemplateParser()
    expect(parser.parse(`{{ replaceMe }}`, { replaceMe: "Hello World" })).toEqual("Hello World")
  });

  it('replaces multiple placeholders in the same template', () => {
    const parser = new ReplaceStringTemplateParser()
    const result = parser.parse(`Hello {{ name }}, you are {{ age }}`, { name: "Ada", age: 36 })
    expect(result).toEqual("Hello Ada, you are 36")
  });

  it('returns empty string when input is undefined', () => {
    const parser = new ReplaceStringTemplateParser()
    expect(parser.parse(undefined as any)).toEqual("")
  });

  it('returns empty string when input is empty string', () => {
    const parser = new ReplaceStringTemplateParser()
    expect(parser.parse("")).toEqual("")
  });

  it('returns templates unchanged when no attributes are provided', () => {
    const parser = new ReplaceStringTemplateParser()
    // Handlebars renders unknown variables as empty by default
    expect(parser.parse(`Hello {{ name }}!`)).toEqual("Hello !")
  });

  it('renders missing variables as empty strings without throwing', () => {
    const parser = new ReplaceStringTemplateParser()
    expect(parser.parse(`Hello {{ name }}`, { other: "value" })).toEqual("Hello ")
  });

  it('supports conditional blocks', () => {
    const parser = new ReplaceStringTemplateParser()
    const tmpl = `{{#if loggedIn}}Welcome back{{else}}Please sign in{{/if}}`
    expect(parser.parse(tmpl, { loggedIn: true })).toEqual("Welcome back")
    expect(parser.parse(tmpl, { loggedIn: false })).toEqual("Please sign in")
  });

  it('supports each blocks over arrays', () => {
    const parser = new ReplaceStringTemplateParser()
    const tmpl = `{{#each items}}-{{this}}{{/each}}`
    expect(parser.parse(tmpl, { items: ["a", "b", "c"] })).toEqual("-a-b-c")
  });

  it('supports nested object access via dot notation', () => {
    const parser = new ReplaceStringTemplateParser()
    expect(parser.parse(`{{ user.name }}`, { user: { name: "Grace" } })).toEqual("Grace")
  });

  it('does not mutate the substitutions object', () => {
    const parser = new ReplaceStringTemplateParser()
    const subs = { name: "Ada" }
    parser.parse(`Hello {{ name }}`, subs)
    expect(subs).toEqual({ name: "Ada" })
  });

  it('escapes HTML by default to prevent injection', () => {
    const parser = new ReplaceStringTemplateParser()
    const result = parser.parse(`{{ html }}`, { html: "<script>alert('x')</script>" })
    expect(result).not.toContain("<script>")
    expect(result).toContain("&lt;script&gt;")
  });

  it('emits raw output when using triple-stache', () => {
    const parser = new ReplaceStringTemplateParser()
    const result = parser.parse(`{{{ html }}}`, { html: "<b>bold</b>" })
    expect(result).toEqual("<b>bold</b>")
  });
});

