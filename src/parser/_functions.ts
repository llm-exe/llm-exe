import { JSONSchema } from "json-schema-to-ts";
import {
  CreateParserType,
  ExecutionContext,
  JsonParserOptions,
  ListToJsonParserOptions,
} from "@/types";
import { LlmExeError } from "@/errors";
import { StringParser } from "./parsers/StringParser";
import { BooleanParser } from "./parsers/BooleanParser";
import { NumberParser } from "./parsers/NumberParser";
import { JsonParser } from "./parsers/JsonParser";
import { ListToJsonParser } from "./parsers/ListToJsonParser";
import { ListToKeyValueParser } from "./parsers/ListToKeyValueParser";
import { CustomParser } from "./parsers/CustomParser";
import { ListToArrayParser } from "./parsers/ListToArrayParser";
import { ReplaceStringTemplateParser } from "./parsers/ReplaceStringTemplateParser";
import { MarkdownCodeBlockParser } from "./parsers/MarkdownCodeBlock";
import { MarkdownCodeBlocksParser } from "./parsers/MarkdownCodeBlocks";
import {
  StringExtractParser,
  StringExtractParserOptions,
} from "./parsers/StringExtractParser";
import { ListToKeyValueParserOptions } from "./parsers/ListToKeyValueParser";
import { NumberParserOptions } from "./parsers/NumberParser";

export type ParserMap<S extends JSONSchema | undefined = undefined> = {
  string: StringParser;
  boolean: BooleanParser;
  number: NumberParser;
  listToArray: ListToArrayParser;
  listToKeyValue: ListToKeyValueParser;
  replaceStringTemplate: ReplaceStringTemplateParser;
  markdownCodeBlock: MarkdownCodeBlockParser;
  markdownCodeBlocks: MarkdownCodeBlocksParser;
  stringExtract: StringExtractParser;
  listToJson: ListToJsonParser<S>;
  json: JsonParser<S>;
};

/**
 * Labeled-tuple union for `createParser` arguments. Each branch enumerates
 * exactly what's valid for one parser type. TypeScript validates the whole
 * argument tuple against this union, which produces useful error messages
 * (e.g. "Source has 1 element(s) but target requires 2" when stringExtract
 * is called without options) instead of overload-resolution mystery.
 */
export type CreateParserArgs =
  | [type: "string", options?: never]
  | [type: "boolean", options?: never]
  | [type: "listToArray", options?: never]
  | [type: "markdownCodeBlock", options?: never]
  | [type: "markdownCodeBlocks", options?: never]
  | [type: "replaceStringTemplate", options?: never]
  | [type: "number", options?: NumberParserOptions]
  | [type: "listToKeyValue", options?: ListToKeyValueParserOptions]
  | [type: "json", options?: JsonParserOptions<JSONSchema | undefined>]
  | [
      type: "listToJson",
      options?: ListToJsonParserOptions<JSONSchema | undefined>,
    ]
  | [type: "stringExtract", options: StringExtractParserOptions<readonly string[]>];

/**
 * Maps a concrete argument tuple back to the parser instance type, preserving
 * schema inference for json/listToJson and enum literal narrowing for
 * stringExtract.
 */
export type CreateParserReturn<A extends readonly unknown[]> =
  A extends readonly ["string", ...unknown[]] ? StringParser
  : A extends readonly ["boolean", ...unknown[]] ? BooleanParser
  : A extends readonly ["number", ...unknown[]] ? NumberParser
  : A extends readonly ["listToArray", ...unknown[]] ? ListToArrayParser
  : A extends readonly ["listToKeyValue", ...unknown[]] ? ListToKeyValueParser
  : A extends readonly ["markdownCodeBlock", ...unknown[]]
    ? MarkdownCodeBlockParser
  : A extends readonly ["markdownCodeBlocks", ...unknown[]]
    ? MarkdownCodeBlocksParser
  : A extends readonly ["replaceStringTemplate", ...unknown[]]
    ? ReplaceStringTemplateParser
  : A extends readonly ["json"] | readonly ["json", undefined]
    ? JsonParser<undefined>
  : A extends readonly ["json", JsonParserOptions<infer S>] ? JsonParser<S>
  : A extends readonly ["listToJson"] | readonly ["listToJson", undefined]
    ? ListToJsonParser<undefined>
  : A extends readonly ["listToJson", ListToJsonParserOptions<infer S>]
    ? ListToJsonParser<S>
  : A extends readonly [
      "stringExtract",
      StringExtractParserOptions<infer E extends readonly string[]>,
    ]
    ? StringExtractParser<E>
  : never;

export function createParser<const A extends CreateParserArgs>(
  ...args: A
): CreateParserReturn<A> {
  const [type, options] = args as [CreateParserType, any];

  switch (type) {
    case "json":
      return new JsonParser(options) as CreateParserReturn<A>;
    case "listToJson":
      return new ListToJsonParser(options) as CreateParserReturn<A>;
    case "stringExtract":
      return new StringExtractParser(options) as CreateParserReturn<A>;
    case "markdownCodeBlocks":
      return new MarkdownCodeBlocksParser() as CreateParserReturn<A>;
    case "markdownCodeBlock":
      return new MarkdownCodeBlockParser() as CreateParserReturn<A>;
    case "listToArray":
      return new ListToArrayParser() as CreateParserReturn<A>;
    case "listToKeyValue":
      return new ListToKeyValueParser(options) as CreateParserReturn<A>;
    case "replaceStringTemplate":
      return new ReplaceStringTemplateParser() as CreateParserReturn<A>;
    case "boolean":
      return new BooleanParser() as CreateParserReturn<A>;
    case "number":
      return new NumberParser(options) as CreateParserReturn<A>;
    case "string":
      return new StringParser() as CreateParserReturn<A>;
    default:
      throw new LlmExeError(
        `Invalid parser type: "${type}"`,
        {
          code: "parser.invalid_type",
          context: {
            operation: "createParser",
            parser: type,
            availableParsers: [
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
            ],
            resolution:
              "Use a registered parser type, or define a custom parser.",
          },
        }
      );
  }
}

export function createCustomParser<O>(
  name: string,
  parserFn: (text: string, context: ExecutionContext<any, any>) => O
): CustomParser<ReturnType<typeof parserFn>> {
  return new CustomParser<ReturnType<typeof parserFn>>(name, parserFn);
}
