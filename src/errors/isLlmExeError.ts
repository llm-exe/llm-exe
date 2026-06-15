import { LLM_EXE_ERROR_SYMBOL, LlmExeError } from "./LlmExeError";
import type { ErrorCodes } from "./types";

export function isLlmExeError<C extends ErrorCodes>(
  error: unknown,
  code?: C | readonly C[]
): error is LlmExeError<C> {
  if (!error || typeof error !== "object") return false;

  const marked =
    error instanceof LlmExeError ||
    (error as { [k: symbol]: unknown })[LLM_EXE_ERROR_SYMBOL] === true ||
    (error as { isLlmExeError?: unknown }).isLlmExeError === true;

  if (!marked) return false;
  if (code === undefined) return true;

  const errorCode = (error as { code?: unknown }).code;
  if (Array.isArray(code)) {
    return code.includes(errorCode as C);
  }
  return errorCode === code;
}