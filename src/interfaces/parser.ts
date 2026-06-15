import { JSONSchema } from "json-schema-to-ts";

export type CreateParserType =
  | "json"
  | "string"
  | "boolean"
  | "number"
  | "stringExtract"
  | "listToArray"
  | "listToJson"
  | "listToKeyValue"
  | "replaceStringTemplate"
  | "markdownCodeBlocks"
  | "markdownCodeBlock";

export interface ParserSchemaOptions<
  S extends JSONSchema | undefined = undefined,
> {
  schema?: S;
  validateSchema?: boolean;
}

export type JsonParserMatch = "exact" | "extract";

export interface JsonParserOptions<S extends JSONSchema | undefined = undefined>
  extends ParserSchemaOptions<S> {
  match?: JsonParserMatch;
}

export interface ListToJsonParserOptions<
  S extends JSONSchema | undefined = undefined,
> extends ParserSchemaOptions<S> {
  keyTransform?: "camelCase" | "preserve";
}

/**
 * @deprecated Use `ParserSchemaOptions` instead. Kept for the schema-bearing
 * BaseParserWithJson constructor; not part of any v3 public surface.
 */
export type BaseParserOptionsWithSchema<
  S extends JSONSchema | undefined = undefined,
> = ParserSchemaOptions<S>;
