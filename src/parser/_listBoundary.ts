import { LlmExeError } from "@/errors";

const LIST_MARKER_PATTERN = /^(?:[-*]\s+|\d+\.\s+|•\s*)/;

export interface ListBoundaryContext {
  operation: string;
  parser: string;
}

export interface NormalizedListLines {
  lines: string[];
  /** 0-based index of each entry in `lines` within the original input. */
  lineIndexes: number[];
  marked: boolean;
}

export function normalizeListLines(
  input: string,
  context: ListBoundaryContext
): NormalizedListLines {
  const lines: string[] = [];
  const lineIndexes: number[] = [];
  input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (line.length > 0) {
        lines.push(line);
        lineIndexes.push(index);
      }
    });

  if (lines.length === 0) {
    throw new LlmExeError(`No list items found in input.`, {
      code: "parser.parse_failed",
      context: {
        operation: context.operation,
        parser: context.parser,
        reason: "empty_input",
        inputLength: input.length,
      },
    });
  }

  const markedStates = lines.map((line) => LIST_MARKER_PATTERN.test(line));
  const hasMarked = markedStates.some(Boolean);
  const hasUnmarked = markedStates.some((marked) => !marked);

  if (hasMarked && hasUnmarked) {
    throw new LlmExeError(`Mixed marked and unmarked list items found.`, {
      code: "parser.parse_failed",
      context: {
        operation: context.operation,
        parser: context.parser,
        reason: "mixed_list_markers",
        inputLength: input.length,
      },
    });
  }

  return {
    lines: hasMarked
      ? lines.map((line) => line.replace(LIST_MARKER_PATTERN, "").trim())
      : lines,
    lineIndexes,
    marked: hasMarked,
  };
}
