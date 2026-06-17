import { BaseParser } from "../_base";
import { LlmExeError } from "@/errors";
import { isDebugEnabled } from "@/utils/modules/debug";

const BOOLEAN_VALUES = ["true", "false", "yes", "no", "y", "n", "1", "0"];
const TRUTHY_VALUES = new Set(["true", "yes", "y", "1"]);
const FALSY_VALUES = new Set(["false", "no", "n", "0"]);
const MAX_ERROR_INPUT_EXCERPT_LENGTH = 500;
const BOOLEAN_TOKEN_PATTERN =
  /(?<![\p{L}\p{N}])(?:true|false|yes|no|y|n|1|0)(?![\p{L}\p{N}])/giu;

export type BooleanParserMatch = "exact" | "extract";

export interface BooleanParserOptions {
  match?: BooleanParserMatch;
}

/**
 * v3 parser contract:
 * Category: strict
 * Mode: exact
 *
 * Accepts only documented boolean literals after trim/lowercase.
 * Returns true/false only when input is recognized. Pass match: "extract" to
 * extract one documented boolean literal from surrounding text.
 * Throws LlmExeError(parser.parse_failed) for empty or unrecognized input.
 * Invalid input types throw LlmExeError(parser.invalid_input).
 * Error context does not include input content unless LLM_EXE_DEBUG is enabled.
 *
 */
export class BooleanParser extends BaseParser<boolean> {
  private match: BooleanParserMatch;

  constructor(options?: BooleanParserOptions) {
    super("boolean");
    this.match = options?.match ?? "exact";
  }

  private getInputErrorContext(text: string) {
    const context: {
      inputLength: number;
      inputExcerpt?: string;
      inputExcerptTruncated?: boolean;
    } = {
      inputLength: text.length,
    };

    if (isDebugEnabled()) {
      const truncated = text.length > MAX_ERROR_INPUT_EXCERPT_LENGTH;
      context.inputExcerpt = truncated
        ? text.slice(0, MAX_ERROR_INPUT_EXCERPT_LENGTH)
        : text;
      context.inputExcerptTruncated = truncated;
    }

    return context;
  }

  parse(text: string, _attributes?: Record<string, any>) {
    if (typeof text !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${text === null ? "null" : typeof text}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "BooleanParser.parse",
            parser: "boolean",
            reason: "invalid_input_type",
            expected: "string",
            received: text === null ? "null" : typeof text,
          },
        },
      );
    }

    const clean = text.toLowerCase().trim();
    if (!clean) {
      throw new LlmExeError(`No boolean value found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "BooleanParser.parse",
          parser: "boolean",
          reason: "empty_input",
          expected: BOOLEAN_VALUES,
          ...this.getInputErrorContext(text),
        },
      });
    }

    if (TRUTHY_VALUES.has(clean)) {
      return true;
    }
    if (FALSY_VALUES.has(clean)) {
      return false;
    }

    if (this.match === "extract") {
      const matches = Array.from(
        text.toLowerCase().matchAll(BOOLEAN_TOKEN_PATTERN),
      ).map((match) => match[0]);
      const values = Array.from(
        new Set(
          matches.map((match) => {
            if (TRUTHY_VALUES.has(match)) return true;
            return false;
          }),
        ),
      );

      if (values.length === 1) {
        return values[0];
      }

      if (values.length > 1) {
        throw new LlmExeError(`Multiple boolean values found in input.`, {
          code: "parser.parse_failed",
          context: {
            operation: "BooleanParser.parse",
            parser: "boolean",
            reason: "ambiguous_boolean",
            expected: "one boolean value",
            match: this.match,
            matchCount: values.length,
            ...this.getInputErrorContext(text),
          },
        });
      }
    }

    throw new LlmExeError(`No boolean value found in input.`, {
      code: "parser.parse_failed",
      context: {
        operation: "BooleanParser.parse",
        parser: "boolean",
        reason: "unrecognized_boolean",
        expected: BOOLEAN_VALUES,
        match: this.match,
        ...this.getInputErrorContext(text),
      },
    });
  }
}
