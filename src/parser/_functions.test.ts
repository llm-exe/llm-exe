import { createParser, createCustomParser } from "./_functions";
import { LlmExeError } from "@/errors";
import { StringParser } from "./parsers/StringParser";
import { BooleanParser } from "./parsers/BooleanParser";
import { NumberParser } from "./parsers/NumberParser";
import { JsonParser } from "./parsers/JsonParser";
import { ListToJsonParser } from "./parsers/ListToJsonParser";
import { ListToKeyValueParser } from "./parsers/ListToKeyValueParser";
import { ListToArrayParser } from "./parsers/ListToArrayParser";
import { ReplaceStringTemplateParser } from "./parsers/ReplaceStringTemplateParser";
import { MarkdownCodeBlockParser } from "./parsers/MarkdownCodeBlock";
import { MarkdownCodeBlocksParser } from "./parsers/MarkdownCodeBlocks";
import { StringExtractParser } from "./parsers/StringExtractParser";
import { CustomParser } from "./parsers/CustomParser";

describe("createParser", () => {
  it("creates a StringParser for type 'string'", () => {
    const parser = createParser("string");
    expect(parser).toBeInstanceOf(StringParser);
  });

  it("creates a BooleanParser for type 'boolean'", () => {
    const parser = createParser("boolean");
    expect(parser).toBeInstanceOf(BooleanParser);
  });

  it("passes options to BooleanParser", () => {
    const parser = createParser("boolean", { match: "extract" });
    expect(parser.parse("The answer is true.")).toBe(true);
  });

  it("creates a NumberParser for type 'number'", () => {
    const parser = createParser("number");
    expect(parser).toBeInstanceOf(NumberParser);
  });

  it("creates a JsonParser for type 'json'", () => {
    const parser = createParser("json");
    expect(parser).toBeInstanceOf(JsonParser);
  });

  it("creates a JsonParser with schema options", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    } as const;
    const parser = createParser("json", { schema });
    expect(parser).toBeInstanceOf(JsonParser);
  });

  it("passes match options to JsonParser", () => {
    const parser = createParser("json", { match: "extract" });
    expect(parser.parse('Here is JSON: {"name":"Greg"}')).toEqual({
      name: "Greg",
    });
  });

  it("creates a ListToJsonParser for type 'listToJson'", () => {
    const parser = createParser("listToJson");
    expect(parser).toBeInstanceOf(ListToJsonParser);
  });

  it("creates a ListToArrayParser for type 'listToArray'", () => {
    const parser = createParser("listToArray");
    expect(parser).toBeInstanceOf(ListToArrayParser);
  });

  it("creates a ListToKeyValueParser for type 'listToKeyValue'", () => {
    const parser = createParser("listToKeyValue");
    expect(parser).toBeInstanceOf(ListToKeyValueParser);
  });

  it("creates a ReplaceStringTemplateParser for type 'replaceStringTemplate'", () => {
    const parser = createParser("replaceStringTemplate");
    expect(parser).toBeInstanceOf(ReplaceStringTemplateParser);
  });

  it("creates a MarkdownCodeBlockParser for type 'markdownCodeBlock'", () => {
    const parser = createParser("markdownCodeBlock");
    expect(parser).toBeInstanceOf(MarkdownCodeBlockParser);
  });

  it("creates a MarkdownCodeBlocksParser for type 'markdownCodeBlocks'", () => {
    const parser = createParser("markdownCodeBlocks");
    expect(parser).toBeInstanceOf(MarkdownCodeBlocksParser);
  });

  it("creates a StringExtractParser for type 'stringExtract'", () => {
    const parser = createParser("stringExtract", {
      enum: ["yes", "no"],
    });
    expect(parser).toBeInstanceOf(StringExtractParser);
  });

  it("throws for an invalid parser type", () => {
    expect(() => {
      // @ts-expect-error runtime contract: invalid parser type throws.
      createParser("invalid");
    }).toThrow(/Invalid parser type: "invalid"/);
  });

  it("throws LlmExeError with parser.invalid_type for an unknown parser type", () => {
    try {
      createParser("nope" as any);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("parser.invalid_type");
      expect((e as LlmExeError).category).toBe("parser");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("createParser");
      expect(ctx.parser).toBe("nope");
      expect(Array.isArray(ctx.availableParsers)).toBe(true);
      expect((ctx.availableParsers as string[]).length).toBeGreaterThan(0);
    }
  });

  it("error context includes all valid parser types in availableParsers", () => {
    try {
      // @ts-expect-error runtime contract: invalid parser type throws.
      createParser("bad");
    } catch (e: any) {
      const available = (e.context?.availableParsers ?? []) as string[];
      expect(available).toEqual(
        expect.arrayContaining([
          "json",
          "string",
          "boolean",
          "number",
          "stringExtract",
          "listToArray",
          "listToJson",
          "listToKeyValue",
          "replaceStringTemplate",
          "markdownCodeBlock",
          "markdownCodeBlocks",
        ]),
      );
    }
  });
});

describe("createCustomParser", () => {
  it("creates a CustomParser with the given name and function", () => {
    const parser = createCustomParser("my-parser", (text) =>
      text.toUpperCase(),
    );
    expect(parser).toBeInstanceOf(CustomParser);
    expect(parser.name).toBe("my-parser");
  });

  it("parser function is invoked correctly", () => {
    const parser = createCustomParser("reverse", (text) =>
      text.split("").reverse().join(""),
    );
    const result = parser.parse("hello", {} as any);
    expect(result).toBe("olleh");
  });

  it("parser receives context as second argument", () => {
    const parserFn = jest.fn((text: string, context: any) => ({
      text,
      hasContext: !!context,
    }));
    const parser = createCustomParser("ctx-parser", parserFn);
    const ctx = { prompt: {}, result: {} } as any;
    parser.parse("input", ctx);
    expect(parserFn).toHaveBeenCalledWith("input", ctx);
  });

  it("can return complex types", () => {
    const parser = createCustomParser("json-extract", (text) => {
      const parsed = JSON.parse(text);
      return {
        items: parsed.items as string[],
        count: parsed.items.length as number,
      };
    });
    const result = parser.parse('{"items": ["a", "b", "c"]}', {} as any);
    expect(result).toEqual({ items: ["a", "b", "c"], count: 3 });
  });
});
