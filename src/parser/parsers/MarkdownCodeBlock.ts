import { MarkdownCodeBlocksParser } from "./MarkdownCodeBlocks";
import { BaseParser } from "../_base";
import { LlmExeError } from "@/errors";

/**
 * v3 parser contract:
 * Category: strict
 * Mode: singular fenced block
 *
 * Accepts input containing exactly one complete fenced markdown code block.
 * Returns that block with exact code content and language string.
 * Throws LlmExeError(parser.parse_failed) for empty input, no block, multiple
 * blocks, malformed fences, or invalid input type.
 *
 */
export class MarkdownCodeBlockParser extends BaseParser<{
  language: string;
  code: string;
}> {
  constructor() {
    super("markdownCodeBlock");
  }
  parse(input: string, _attributes?: Record<string, any>) {
    if (typeof input !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${input === null ? "null" : Array.isArray(input) ? "array" : typeof input}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "MarkdownCodeBlockParser.parse",
            parser: "markdownCodeBlock",
            reason: "invalid_input_type",
            expected: "string",
            received: input === null ? "null" : Array.isArray(input) ? "array" : typeof input,
          },
        }
      );
    }

    if (input.trim() === "") {
      throw new LlmExeError(`No markdown code block found.`, {
        code: "parser.parse_failed",
        context: {
          operation: "MarkdownCodeBlockParser.parse",
          parser: "markdownCodeBlock",
          reason: "empty_input",
          inputLength: input.length,
        },
      });
    }

    const blocks = new MarkdownCodeBlocksParser().parse(input);
    if (blocks.length === 0) {
      throw new LlmExeError(`No markdown code block found.`, {
        code: "parser.parse_failed",
        context: {
          operation: "MarkdownCodeBlockParser.parse",
          parser: "markdownCodeBlock",
          reason: "no_code_block",
          inputLength: input.length,
        },
      });
    }

    if (blocks.length > 1) {
      throw new LlmExeError(`Multiple markdown code blocks found.`, {
        code: "parser.parse_failed",
        context: {
          operation: "MarkdownCodeBlockParser.parse",
          parser: "markdownCodeBlock",
          reason: "multiple_code_blocks",
          inputLength: input.length,
          matchCount: blocks.length,
        },
      });
    }

    return blocks[0];
  }
}
