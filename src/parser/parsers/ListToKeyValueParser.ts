import { BaseParser } from "../_base";
import { LlmExeError } from "@/errors";
import { normalizeListLines } from "../_listBoundary";
import { camelCase } from "@/utils/modules/camelCase";

export interface ListToKeyValueParserOptions {
  keyTransform?: "preserve" | "camelCase";
}

export class ListToKeyValueParser extends BaseParser<
  Array<{ key: string; value: string }>
> {
  private keyTransform: "preserve" | "camelCase";

  constructor(options?: ListToKeyValueParserOptions) {
    super("listToKeyValue");
    this.keyTransform = options?.keyTransform ?? "preserve";
  }
  /**
   * v3 parser contract:
   * Category: converter
   * Mode: line-oriented collector
   *
   * Uses the shared list boundary. Parses normalized lines as key/value pairs
   * split at the first colon. Preserves duplicate keys because output is an
   * ordered array. Keys are returned as written by default; pass
   * keyTransform: "camelCase" to match listToJson's key normalization.
   *
   */
  parse(text: string, _attributes?: Record<string, any>) {
    if (typeof text !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${text === null ? "null" : Array.isArray(text) ? "array" : typeof text}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "ListToKeyValueParser.parse",
            parser: "listToKeyValue",
            reason: "invalid_input_type",
            expected: "string",
            received: text === null ? "null" : Array.isArray(text) ? "array" : typeof text,
          },
        }
      );
    }

    const { lines } = normalizeListLines(text, {
      operation: "ListToKeyValueParser.parse",
      parser: "listToKeyValue",
    });

    let res: Array<{ key: string; value: string }> = [];
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) {
        throw new LlmExeError(`Malformed key/value line.`, {
          code: "parser.parse_failed",
          context: {
            operation: "ListToKeyValueParser.parse",
            parser: "listToKeyValue",
            reason: "malformed_line",
            inputLength: text.length,
          },
        });
      }

      const rawKey = line.slice(0, colonIndex).trim();
      if (!rawKey) {
        throw new LlmExeError(`Empty key in key/value line.`, {
          code: "parser.parse_failed",
          context: {
            operation: "ListToKeyValueParser.parse",
            parser: "listToKeyValue",
            reason: "empty_key",
            inputLength: text.length,
          },
        });
      }

      const key =
        this.keyTransform === "camelCase" ? camelCase(rawKey) : rawKey;
      res.push({ key, value: line.slice(colonIndex + 1).trim() });
    }
    return res;
  }
}
