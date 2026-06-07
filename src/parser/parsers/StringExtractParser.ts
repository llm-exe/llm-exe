import { BaseParser } from "../_base";
import { LlmExeError } from "@/errors";

export type StringExtractMatch = "exact" | "word" | "substring";

export interface StringExtractParserOptions<
  E extends readonly string[] = readonly string[],
> {
  enum: E;
  ignoreCase?: boolean;
  match?: StringExtractMatch;
}

const REGEX_METACHAR = /[.*+?^${}()|[\]\\]/g;
const WORD_CHAR = "[\\p{L}\\p{N}]";

function escapeRegex(value: string): string {
  return value.replace(REGEX_METACHAR, "\\$&");
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export class StringExtractParser<
  E extends readonly string[] = readonly string[],
> extends BaseParser<E[number]> {
  private enum: string[] = [];
  private ignoreCase: boolean;
  private match: StringExtractMatch;

  constructor(options?: StringExtractParserOptions<E>) {
    super("stringExtract");
    if (options?.enum) {
      this.enum.push(...options.enum);
    }
    this.ignoreCase = options?.ignoreCase ?? true;
    this.match = options?.match ?? "word";
  }

  /**
   * v3 parser contract:
   * Category: extractor
   * Mode: configured value extraction
   *
   * Returns the single configured enum value found in input. Matching is
   * word-bounded by default; pass match: "exact" to require exact input or
   * match: "substring" for legacy contains() behavior. Case-insensitive by
   * default.
   *
   */
  parse(text: string, _attributes?: Record<string, any>): E[number] {
    if (typeof text !== "string") {
      const received = describeType(text);
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${received}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "StringExtractParser.parse",
            parser: "stringExtract",
            reason: "invalid_input_type",
            expected: "string",
            received,
          },
        },
      );
    }

    if (this.enum.length === 0) {
      throw new LlmExeError(`No enum values configured.`, {
        code: "parser.parse_failed",
        context: {
          operation: "StringExtractParser.parse",
          parser: "stringExtract",
          reason: "no_enum_values",
          expected: "non-empty enum",
          inputLength: text.length,
        },
      });
    }

    if (text.length === 0) {
      if (this.enum.includes("")) {
        return "" as E[number];
      }

      throw new LlmExeError(`No matching enum value found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "StringExtractParser.parse",
          parser: "stringExtract",
          reason: "empty_input",
          expected: this.enum,
          inputLength: text.length,
        },
      });
    }

    const matches = this.findMatches(text);
    const uniqueMatches = Array.from(new Set(matches));

    if (uniqueMatches.length === 1) {
      return uniqueMatches[0] as E[number];
    }

    if (uniqueMatches.length > 1) {
      throw new LlmExeError(`Multiple enum values found in input.`, {
        code: "parser.parse_failed",
        context: {
          operation: "StringExtractParser.parse",
          parser: "stringExtract",
          reason: "ambiguous_enum_match",
          expected: this.enum,
          match: this.match,
          inputLength: text.length,
          matchCount: uniqueMatches.length,
        },
      });
    }

    throw new LlmExeError(`No matching enum value found in input.`, {
      code: "parser.parse_failed",
      context: {
        operation: "StringExtractParser.parse",
        parser: "stringExtract",
        reason: "no_enum_match",
        expected: this.enum,
        match: this.match,
        inputLength: text.length,
      },
    });
  }

  private findMatches(text: string): string[] {
    switch (this.match) {
      case "exact":
        return this.matchExact(text);
      case "substring":
        return this.matchSubstring(text);
      case "word":
      default:
        return this.matchWord(text);
    }
  }

  private matchExact(text: string): string[] {
    const candidate = this.ignoreCase ? text.trim().toLowerCase() : text.trim();
    return this.enum.filter((option) => {
      if (option === "") return false;
      const normalized = this.ignoreCase ? option.toLowerCase() : option;
      return candidate === normalized;
    });
  }

  private matchSubstring(text: string): string[] {
    const haystack = this.ignoreCase ? text.toLowerCase() : text;
    return this.enum.filter((option) => {
      if (option === "") return false;
      const needle = this.ignoreCase ? option.toLowerCase() : option;
      return haystack.includes(needle);
    });
  }

  private matchWord(text: string): string[] {
    const flags = this.ignoreCase ? "iu" : "u";
    return this.enum.filter((option) => {
      if (option === "") return false;
      const pattern = new RegExp(
        `(?<!${WORD_CHAR})${escapeRegex(option)}(?!${WORD_CHAR})`,
        flags,
      );
      return pattern.test(text);
    });
  }
}
