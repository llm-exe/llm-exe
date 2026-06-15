import { BaseParser, BooleanParser, JsonParser, ListToArrayParser, ListToJsonParser, ListToKeyValueParser, MarkdownCodeBlockParser, MarkdownCodeBlocksParser, NumberParser, ReplaceStringTemplateParser, StringParser, createParser } from "@/parser";
import { StringExtractParser } from "@/parser/parsers/StringExtractParser";
import { defineSchema } from "@/utils/modules/defineSchema";

/**
 * Tests the createParser class
 */
describe("llm-exe:parser/createParser", () => {
  it('creates string parser', () => {
    const parser = createParser("string");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(StringParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("string")
  })
  it('creates stringExtract parser', () => {
    const parser = createParser("stringExtract", { enum: ["yes", "no"] });
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(StringExtractParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("stringExtract")
  })
  it('creates json parser', () => {
    const parser = createParser("json");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(JsonParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("json")
  })
  it('creates json parser', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        occupation: { type: "string", default: "unemployed" },
      },
      required: ["occupation", "name"],
      additionalProperties: false,
    });
    const parser = createParser("json", {schema});
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(JsonParser)
    expect(parser).toHaveProperty("name")
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("json")
  })
  it('creates boolean parser', () => {
    const parser = createParser("boolean");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(BooleanParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("boolean")
  })
  it('creates number parser', () => {
    const parser = createParser("number");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(NumberParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("number")
  })
  it('creates listToArray parser', () => {
    const parser = createParser("listToArray");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ListToArrayParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("listToArray")
  })
  it('creates listToJson parser', () => {
    const parser = createParser("listToJson");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ListToJsonParser) 
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("listToJson")
  })
  it('creates listToKeyValue parser', () => {
    const parser = createParser("listToKeyValue");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ListToKeyValueParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("listToKeyValue")
  })
  it('creates replaceStringTemplate parser', () => {
    const parser = createParser("replaceStringTemplate");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ReplaceStringTemplateParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("replaceStringTemplate")
  })
  it('creates markdownCodeBlocks parser', () => {
    const parser = createParser("markdownCodeBlocks");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(MarkdownCodeBlocksParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("markdownCodeBlocks")
  })
  it('creates markdownCodeBlock parser', () => {
    const parser = createParser("markdownCodeBlock");
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(MarkdownCodeBlockParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("markdownCodeBlock")
  })
  it('throws error for invalid parser type', () => {
    expect(() => createParser("xml" as any)).toThrow(
      'Invalid parser type: "xml"'
    );
  })
  it('throws error for typo in parser type', () => {
    expect(() => createParser("jsonn" as any)).toThrow(
      'Invalid parser type: "jsonn"'
    );
  })
  it('error context includes availableParsers', () => {
    try {
      createParser("invalid" as any);
    } catch (e: any) {
      const available = (e.context?.availableParsers ?? []) as string[];
      expect(available.length).toBeGreaterThan(0);
      expect(available).toContain("json");
    }
  })
});

