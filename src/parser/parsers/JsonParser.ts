import { BaseParserWithJson } from "../_base";
import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { JsonParserOptions } from "@/types";
import {
  applyParserSchemaDefaultsAndFilter,
  enforceParserSchema,
  validateParserSchema,
} from "../_utils";
import { LlmExeError } from "@/errors";

export type JsonParserInput = string | Record<string, unknown> | unknown[];
type JsonParserOutput<S extends JSONSchema | undefined> = S extends JSONSchema
  ? FromSchema<S>
  : Record<string, any>;
type JsonCandidate = {
  parsed: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeExactResponseJsonText(input: string) {
  const trimmed = input.trim();
  const fenceMatch = trimmed.match(
    /^```([a-zA-Z]*)[^\S\r\n]*\r?\n([\s\S]*)```$/,
  );

  if (!fenceMatch) {
    return trimmed;
  }

  const [, language, body] = fenceMatch;
  if (language && language.toLowerCase() !== "json") {
    return trimmed;
  }

  return body.trim();
}

/**
 * Maps the index of each `{`/`[` opener to the index of its balanced closer,
 * in a single string-aware pass. A closer that does not match the innermost
 * open bracket invalidates every span still open at that point (matching the
 * previous per-position scanner, where each of those scans would hit the same
 * mismatch and give up). One pass keeps extraction O(n) — rescanning from
 * every opener is O(n²) on inputs with long runs of unbalanced brackets,
 * which stalls the event loop on large model responses.
 *
 * Quotes are only treated as string delimiters while a bracket is open. Text
 * outside any bracket is surrounding prose (extract mode's whole purpose), and
 * a stray or unbalanced quote there — dialogue, an inch mark like `5"`, odd
 * quoting in reasoning text — must not leak `inString` state into the JSON that
 * follows. The previous per-opener scanner started with fresh string state at
 * each `{`/`[`, so preamble quotes could not corrupt a later object's scan;
 * gating on `openerIndexes.length` preserves that isolation in one pass.
 */
function mapBalancedJsonEnds(input: string): Map<number, number> {
  const balancedEnds = new Map<number, number>();
  const openerIndexes: number[] = [];
  let inString = false;
  let escaping = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      // Only start tracking a string inside an open bracket; quotes in the
      // surrounding prose are ignored so they can't swallow the real opener.
      if (openerIndexes.length > 0) {
        inString = true;
      }
      continue;
    }

    if (char === "{" || char === "[") {
      openerIndexes.push(index);
      continue;
    }

    if (char !== "}" && char !== "]") {
      continue;
    }

    const openerIndex = openerIndexes[openerIndexes.length - 1];
    const expectedCloser =
      openerIndex === undefined
        ? undefined
        : input[openerIndex] === "{"
          ? "}"
          : "]";

    if (expectedCloser === char) {
      openerIndexes.pop();
      balancedEnds.set(openerIndex as number, index);
    } else {
      openerIndexes.length = 0;
    }
  }

  return balancedEnds;
}

function extractJsonCandidates(input: string): JsonCandidate[] {
  const candidates: JsonCandidate[] = [];
  const balancedEnds = mapBalancedJsonEnds(input);

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char !== "{" && char !== "[") {
      continue;
    }

    const end = balancedEnds.get(index);
    if (end === undefined) {
      continue;
    }

    const candidate = input.slice(index, end + 1);
    try {
      candidates.push({
        parsed: JSON.parse(candidate),
      });
      index = end;
    } catch {
      // Balanced brackets can still contain non-JSON content.
    }
  }

  return candidates;
}

export class JsonParser<
  S extends JSONSchema | undefined = undefined,
> extends BaseParserWithJson<S, JsonParserOutput<S>, JsonParserInput> {
  private shouldValidateSchema: boolean;
  private match: JsonParserOptions<S>["match"];

  constructor(options: JsonParserOptions<S> = {}) {
    super("json", options);
    this.match = options.match ?? "exact";
    this.shouldValidateSchema =
      !!options.schema && options.validateSchema !== false;
  }

  /**
   * v3 parser contract:
   * Category: strict
   * Mode: exact
   *
   * Parses strict JSON object/array output by default. Pass match: "extract"
   * to extract one JSON object or array from surrounding text. Invalid JSON,
   * empty input, JSON primitives, and non-plain runtime objects throw typed parser errors.
   * Schema validation is on by default when a schema is provided unless
   * validateSchema: false is explicitly set.
   *
   */
  parse(
    text: JsonParserInput,
    _attributes?: Record<string, any>,
  ): JsonParserOutput<S> {
    let parsed: unknown;
    let inputLength: number | undefined;

    if (typeof text === "string") {
      inputLength = text.length;
      if (text.trim() === "") {
        throw new LlmExeError(`No JSON value found in input.`, {
          code: "parser.parse_failed",
          context: {
            operation: "JsonParser.parse",
            parser: "json",
            reason: "empty_input",
            expected: "JSON object or array",
            inputLength,
          },
        });
      }

      try {
        parsed = JSON.parse(normalizeExactResponseJsonText(text));
      } catch (cause) {
        if (this.match === "extract") {
          const candidates = extractJsonCandidates(text);

          if (candidates.length === 1) {
            parsed = candidates[0].parsed;
          } else if (candidates.length > 1) {
            throw new LlmExeError(`Multiple JSON values found in input.`, {
              code: "parser.parse_failed",
              context: {
                operation: "JsonParser.parse",
                parser: "json",
                reason: "ambiguous_json_match",
                expected: "one JSON object or array",
                match: this.match,
                inputLength,
                matchCount: candidates.length,
              },
            });
          } else {
            throw new LlmExeError(`No JSON value found in input.`, {
              code: "parser.parse_failed",
              context: {
                operation: "JsonParser.parse",
                parser: "json",
                reason: "no_json_value",
                expected: "JSON object or array",
                match: this.match,
                inputLength,
              },
              cause,
            });
          }
        } else {
          throw new LlmExeError(`Invalid JSON input.`, {
            code: "parser.parse_failed",
            context: {
              operation: "JsonParser.parse",
              parser: "json",
              reason: "invalid_json",
              expected: "JSON object or array",
              inputLength,
            },
            cause,
          });
        }
      }
    } else if (Array.isArray(text) || isPlainObject(text)) {
      parsed = text;
    } else {
      throw new LlmExeError(
        `Invalid input. Expected JSON string, plain object, or array. Received ${text === null ? "null" : typeof text}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "JsonParser.parse",
            parser: "json",
            reason: "invalid_input_type",
            expected: "JSON string, plain object, or array",
            received: text === null ? "null" : typeof text,
          },
        },
      );
    }

    if (!Array.isArray(parsed) && !isPlainObject(parsed)) {
      throw new LlmExeError(`Invalid JSON root type.`, {
        code: "parser.parse_failed",
        context: {
          operation: "JsonParser.parse",
          parser: "json",
          reason: "invalid_json_root_type",
          expected: "JSON object or array",
          received: parsed === null ? "null" : typeof parsed,
          inputLength,
        },
      });
    }

    if (this.schema) {
      if (this.shouldValidateSchema) {
        const valid = validateParserSchema(this.schema, parsed as any);
        if (valid && valid.length) {
          throw new LlmExeError(valid[0].message, {
            code: "parser.schema_validation_failed",
            context: {
              operation: "JsonParser.parse",
              parser: "json",
              schemaErrors: valid.map((error) => error.message),
            },
          });
        }
      }
      if (this.shouldValidateSchema) {
        return applyParserSchemaDefaultsAndFilter(
          this.schema,
          parsed,
        ) as JsonParserOutput<S>;
      }
      return enforceParserSchema(this.schema, parsed) as JsonParserOutput<S>;
    }
    return parsed as JsonParserOutput<S>;
  }
}
