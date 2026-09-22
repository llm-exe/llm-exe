import type { BaseLlCall, OutputUsage } from "@/types";
import { isLlmExeError } from "@/errors";
import type { ResponseErrorContext } from "@/errors";

// Parser failures the executor can enrich. Other codes (and non-llm-exe
// errors) pass through untouched.
const ENRICHABLE_CODES = [
  "parser.parse_failed",
  "parser.invalid_input",
  "parser.schema_validation_failed",
] as const;

function readResponseContext(out: BaseLlCall): ResponseErrorContext {
  const context: ResponseErrorContext = {};
  if (!out || typeof out.getResult !== "function") return context;

  let result: { usage?: OutputUsage; stopReason?: string } | undefined;
  try {
    result = out.getResult();
  } catch {
    // A response we cannot read is the same as no response: enrich nothing
    // rather than masking the parser failure with a secondary error.
    return context;
  }
  if (!result || typeof result !== "object") return context;

  if (result.usage && typeof result.usage === "object") {
    context.usage = result.usage;
  }
  if (typeof result.stopReason === "string" && result.stopReason) {
    context.stopReason = result.stopReason;
  }
  return context;
}

/**
 * Attaches normalized usage and stop reason from a completed response to a
 * parser failure, in place, so direct catch callers, error hooks and
 * `toJSON()` all see the same enriched context.
 *
 * The error instance, code, message, cause and stack are preserved, and
 * existing context keys win — the response only fills in what is missing.
 */
export function attachResponseContext<E>(error: E, out: BaseLlCall): E {
  if (!isLlmExeError(error, ENRICHABLE_CODES)) return error;

  const responseContext = readResponseContext(out);
  const keys = Object.keys(responseContext) as (keyof ResponseErrorContext)[];
  if (keys.length === 0) return error;

  const existing = (error.context || {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing };
  for (const key of keys) {
    if (merged[key] === undefined) {
      merged[key] = responseContext[key];
    }
  }

  (error as { context: unknown }).context = merged;
  return error;
}
