import { BaseParser } from "../_base";
import { isFinite } from "@/utils/modules/isFinite";
import { toNumber } from "@/utils/modules/toNumber";
import { LlmExeError } from "@/errors";

export type NumberParserMatch = "exact" | "extract";

export interface NumberParserOptions {
  match?: NumberParserMatch;
}

const NUMERIC_TOKEN_PATTERN =
  /(^|[^\w.,])([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)(?![\w,])/g;
const EXACT_NUMERIC_PATTERN =
  /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * v3 parser contract:
 * Category: extractor
 * Mode: numeric token extraction
 *
 * Extracts one documented numeric token from text. Pass match: "exact" to
 * require the input to consist of exactly one numeric token (after trim) with
 * no surrounding prose.
 *
 * Throws LlmExeError(parser.parse_failed) for empty input, no numeric token,
 * multiple numeric tokens, invalid conversion. Invalid input type throws
 * LlmExeError(parser.invalid_input).
 */
export class NumberParser extends BaseParser<number> {
  private match: NumberParserMatch;

  constructor(options?: NumberParserOptions) {
    super("number");
    this.match = options?.match ?? "extract";
  }

  parse(text: string, _attributes?: Record<string, any>) {
    if (typeof text !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${text === null ? "null" : Array.isArray(text) ? "array" : typeof text}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "NumberParser.parse",
            parser: "number",
            reason: "invalid_input_type",
            expected: "string",
            received:
              text === null
                ? "null"
                : Array.isArray(text)
                  ? "array"
                  : typeof text,
          },
        },
      );
    }

    if (text.trim() === "") {
      throw new LlmExeError(`No numeric value found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "NumberParser.parse",
          parser: "number",
          reason: "empty_input",
          expected: "number",
          inputLength: text.length,
        },
      });
    }

    if (this.match === "exact") {
      const trimmed = text.trim();
      if (!EXACT_NUMERIC_PATTERN.test(trimmed)) {
        throw new LlmExeError(`Input is not an exact numeric value.`, {
          code: "parser.parse_failed",
          context: {
            operation: "NumberParser.parse",
            parser: "number",
            reason: "no_numeric_value",
            expected: "exact number",
            match: this.match,
            inputLength: text.length,
          },
        });
      }

      const value = toNumber(trimmed.replace(/,/g, ""));
      /* istanbul ignore next -- EXACT_NUMERIC_PATTERN only accepts finite Number-compatible tokens; this guard is defensive if the pattern changes. */
      if (!isFinite(value)) {
        throw new LlmExeError(`Invalid numeric value found in input.`, {
          code: "parser.parse_failed",
          context: {
            operation: "NumberParser.parse",
            parser: "number",
            reason: "invalid_number",
            expected: "finite number",
            match: this.match,
            inputLength: text.length,
          },
        });
      }
      return value;
    }

    const matches = Array.from(text.matchAll(NUMERIC_TOKEN_PATTERN)).map(
      (match) => match[2],
    );

    if (matches.length === 0) {
      throw new LlmExeError(`No numeric value found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "NumberParser.parse",
          parser: "number",
          reason: "no_numeric_value",
          expected: "number",
          match: this.match,
          inputLength: text.length,
        },
      });
    }

    if (matches.length > 1) {
      throw new LlmExeError(`Multiple numeric values found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "NumberParser.parse",
          parser: "number",
          reason: "ambiguous_number",
          expected: "one numeric value",
          match: this.match,
          inputLength: text.length,
          matchCount: matches.length,
        },
      });
    }

    const value = toNumber(matches[0].replace(/,/g, ""));
    /* istanbul ignore next -- NUMERIC_TOKEN_PATTERN only captures finite Number-compatible tokens; this guard is defensive if the pattern changes. */
    if (!isFinite(value)) {
      throw new LlmExeError(`Invalid numeric value found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "NumberParser.parse",
          parser: "number",
          reason: "invalid_number",
          expected: "finite number",
          match: this.match,
          inputLength: text.length,
        },
      });
    }

    return value;
  }
}
