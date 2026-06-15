import { isLlmExeError } from "./isLlmExeError";

export interface ErrorMetadataFields {
  errorCategory?: string;
  errorCode?: string;
  errorContext?: unknown;
  errorCause?: unknown;
}

/**
 * Projects an LlmExeError into a flat field bag for metadata storage
 * (executor metadata, hook error records, etc.). Returns an empty object for
 * anything else, so callers can spread the result unconditionally.
 */
export function getErrorMetadata(error: unknown): ErrorMetadataFields {
  if (!isLlmExeError(error)) return {};
  return {
    errorCategory: error.category,
    errorCode: error.code,
    errorContext: error.context,
    errorCause: (error as unknown as { cause?: unknown }).cause,
  };
}
