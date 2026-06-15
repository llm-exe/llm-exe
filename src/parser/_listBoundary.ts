import { LlmExeError } from "@/errors";

const LIST_MARKER_PATTERN = /^(?:[-*]\s+|\d+\.\s+|•\s*)/;

export interface ListBoundaryContext {
  operation: string;
  parser: string;
}

export interface NormalizedListLines {
  lines: string[];
  marked: boolean;
}

export function normalizeListLines(
  input: string,
  context: ListBoundaryContext
): NormalizedListLines {
  const lines = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

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
    marked: hasMarked,
  };
}
