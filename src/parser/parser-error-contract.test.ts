import {
  BooleanParser,
  JsonParser,
  ListToArrayParser,
  ListToJsonParser,
  ListToKeyValueParser,
  MarkdownCodeBlockParser,
  MarkdownCodeBlocksParser,
  NumberParser,
  ReplaceStringTemplateParser,
  StringExtractParser,
  StringParser,
} from "@/parser";
import { LlmExeError, isLlmExeError } from "@/errors";

describe("llm-exe:parser/error contract", () => {
  const parseFailures: Array<{
    name: string;
    parse: () => unknown;
  }> = [
    {
      name: "boolean",
      parse: () => new BooleanParser().parse("maybe"),
    },
    {
      name: "json",
      parse: () => new JsonParser().parse("not json"),
    },
    {
      name: "listToArray",
      parse: () => new ListToArrayParser().parse("not a list"),
    },
    {
      name: "listToJson",
      parse: () => new ListToJsonParser().parse("Name Greg"),
    },
    {
      name: "listToKeyValue",
      parse: () => new ListToKeyValueParser().parse("Name Greg"),
    },
    {
      name: "markdownCodeBlock",
      parse: () => new MarkdownCodeBlockParser().parse("no block"),
    },
    {
      name: "markdownCodeBlocks",
      parse: () => new MarkdownCodeBlocksParser().parse("```ts\nunterminated"),
    },
    {
      name: "number",
      parse: () => new NumberParser().parse("not a number"),
    },
    {
      name: "replaceStringTemplate",
      parse: () => new ReplaceStringTemplateParser().parse("Hello {{#if name}}"),
    },
    {
      name: "stringExtract",
      parse: () => new StringExtractParser({ enum: ["yes"] }).parse("maybe"),
    },
  ];

  const invalidInputs: Array<{
    name: string;
    parse: () => unknown;
  }> = [
    {
      name: "string",
      parse: () => {
        // @ts-expect-error runtime contract: parser rejects non-string input.
        new StringParser().parse(42);
      },
    },
  ];

  it.each(parseFailures)("$name throws parser.parse_failed as LlmExeError", ({ parse }) => {
    try {
      parse();
      fail("Expected an error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmExeError);
      expect((error as LlmExeError).code).toEqual("parser.parse_failed");
      expect(isLlmExeError(error, "parser.parse_failed")).toBe(true);
    }
  });

  it.each(invalidInputs)("$name throws parser.invalid_input as LlmExeError", ({ parse }) => {
    try {
      parse();
      fail("Expected an error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmExeError);
      expect((error as LlmExeError).code).toEqual("parser.invalid_input");
      expect(isLlmExeError(error, "parser.invalid_input")).toBe(true);
    }
  });

  it("matches parser.schema_validation_failed errors by code", () => {
    const parser = new JsonParser({
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      } as const,
    });

    try {
      parser.parse("{}");
      fail("Expected an error to be thrown");
    } catch (error) {
      expect(isLlmExeError(error, "parser.schema_validation_failed")).toBe(true);
      expect(isLlmExeError(error, "parser.parse_failed")).toBe(false);
    }
  });
});
