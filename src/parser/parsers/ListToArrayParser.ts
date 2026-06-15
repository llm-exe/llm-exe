import { BaseParser } from "../_base";
import { normalizeListLines } from "../_listBoundary";
import { LlmExeError } from "@/errors";

/**
 * v3 parser contract:
 * Category: converter
 * Mode: line-oriented collection conversion
 *
 * Uses the shared list boundary. Returns normalized item text exactly.
 * Throws for empty input, invalid input type, mixed marked/unmarked lines, or
 * a single unmarked prose line.
 *
 */
export class ListToArrayParser extends BaseParser<string[]> {
  constructor() {
    super("listToArray");
  }
  parse(text: string, _attributes?: Record<string, any>) {
    if (typeof text !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${text === null ? "null" : Array.isArray(text) ? "array" : typeof text}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "ListToArrayParser.parse",
            parser: "listToArray",
            reason: "invalid_input_type",
            expected: "string",
            received: text === null ? "null" : Array.isArray(text) ? "array" : typeof text,
          },
        }
      );
    }

    const normalized = normalizeListLines(text, {
      operation: "ListToArrayParser.parse",
      parser: "listToArray",
    });

    if (!normalized.marked && normalized.lines.length === 1) {
      throw new LlmExeError(`Input is not list-like.`, {
        code: "parser.parse_failed",
        context: {
          operation: "ListToArrayParser.parse",
          parser: "listToArray",
          reason: "not_list_like",
          inputLength: text.length,
        },
      });
    }

    return normalized.lines;
  }
}
