import { BaseParser } from "../_base";
import { LlmExeError } from "@/errors";

/**
 * v3 parser contract:
 * Category: collector
 * Mode: markdown fenced block collection
 *
 * Accepts text containing zero or more complete fenced code blocks.
 * Returns all complete blocks in source order.
 * Returns [] when no complete block exists.
 * Throws LlmExeError(parser.parse_failed) for invalid input type or malformed
 * fence structure. Does not unwrap stringified JSON.
 *
 */
export class MarkdownCodeBlocksParser extends BaseParser<
  { language: string; code: string }[]
> {
  constructor() {
    super("markdownCodeBlocks");
  }
  parse(input: string, _attributes?: Record<string, any>) {
    if (typeof input !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${input === null ? "null" : Array.isArray(input) ? "array" : typeof input}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "MarkdownCodeBlocksParser.parse",
            parser: "markdownCodeBlocks",
            reason: "invalid_input_type",
            expected: "string",
            received: input === null ? "null" : Array.isArray(input) ? "array" : typeof input,
          },
        }
      );
    }

    const out: { code: string; language: string }[] = [];

    const fenceCount = input.match(/```/g)?.length ?? 0;
    if (fenceCount % 2 !== 0) {
      throw new LlmExeError(`Malformed markdown code block.`, {
        code: "parser.parse_failed",
        context: {
          operation: "MarkdownCodeBlocksParser.parse",
          parser: "markdownCodeBlocks",
          reason: "malformed_code_block",
          inputLength: input.length,
        },
      });
    }

    const regex = input.matchAll(new RegExp(/```(\w*)\n([\s\S]*?)```/, "g"));
    for (const iterator of regex) {
      if (iterator) {
        const [_input, language, code] = iterator;
        out.push({
          language,
          code,
        });
      }
    }
    return out;
  }
}
