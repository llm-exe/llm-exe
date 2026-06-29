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
  /**
   * Controls schema enforcement when `schema` is provided. Validation —
   * including `required` fields and type/constraint checks — is **on by
   * default** whenever a schema is set; invalid or incomplete input throws a
   * `parser.schema_validation_failed` error.
   *
   * Set `validateSchema: false` to opt out into the legacy filter/default-only
   * behavior: unknown keys are stripped and defaults applied, but `required`
   * fields and constraints are NOT checked. Has no effect when no schema is set.
   *
   * @default true (when `schema` is provided)
   */
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
