import type { NormalizedProviderError } from "./types";
import { redactSecrets } from "@/utils/modules/redactSecrets";

const PROVIDER_MESSAGE_MAX_LENGTH = 240;

export function safeProviderString(
  value: string | undefined,
  maxLength = PROVIDER_MESSAGE_MAX_LENGTH
): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const scrubbed = redactSecrets(value);
  return scrubbed.length > maxLength
    ? scrubbed.slice(0, maxLength) + "…(truncated)"
    : scrubbed;
}

const SECRET_KEY_REGEX =
  /authorization|api[-_]?key|secret|token|password|cookie|set-cookie|x-amz/i;
const REDACTED = "[redacted]";

const DEFAULT_MAX_BODY_BYTES = 8192;
const DEFAULT_MAX_STRING_LENGTH = 2000;
const MAX_SCRUB_DEPTH = 8;

const ALLOWED_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  // Generic diagnostic headers
  "content-type",
  "retry-after",
  // Request/correlation IDs
  "request-id",
  "x-request-id",
  "x-amzn-requestid",
  "x-amz-request-id",
  "x-goog-request-id",
  // OpenAI-style rate-limit headers
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-tokens",
  // Anthropic-style rate-limit headers
  "anthropic-ratelimit-requests-limit",
  "anthropic-ratelimit-requests-remaining",
  "anthropic-ratelimit-requests-reset",
  "anthropic-ratelimit-tokens-limit",
  "anthropic-ratelimit-tokens-remaining",
  "anthropic-ratelimit-tokens-reset",
]);

export type SafeErrorContextOptions = {
  maxStringLength?: number;
  maxBodyBytes?: number;
};

export function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "…(truncated)";
}

function scrub(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  maxStringLength: number,
): unknown {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "string")
    return redactSecrets(truncateString(value as string, maxStringLength));
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return (value as bigint).toString();
  if (t === "symbol") return String(value);
  if (t === "function") return "[Function]";

  if (depth >= MAX_SCRUB_DEPTH) return "[deep]";
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);

  try {
    if (Array.isArray(value)) {
      const arr: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        arr.push(scrub(value[i], seen, depth + 1, maxStringLength));
      }
      return arr;
    }

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object)) {
      if (SECRET_KEY_REGEX.test(key)) {
        out[key] = REDACTED;
        continue;
      }
      const v = (value as Record<string, unknown>)[key];
      out[key] = scrub(v, seen, depth + 1, maxStringLength);
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

export function safeProviderErrorBody(
  value: unknown,
  options?: SafeErrorContextOptions,
): unknown {
  const maxStringLength = options?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const maxBodyBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  if (typeof value === "string") {
    return redactSecrets(truncateString(value, maxBodyBytes));
  }

  return scrub(value, new WeakSet(), 0, maxStringLength);
}

export function safeResponseHeaders(
  headers: Headers | Record<string, string> | undefined | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;

  if (
    typeof (headers as Headers).forEach === "function" &&
    typeof (headers as Headers).get === "function"
  ) {
    (headers as Headers).forEach((value, key) => {
      const lower = key.toLowerCase();
      if (ALLOWED_RESPONSE_HEADERS.has(lower) && typeof value === "string") {
        out[lower] = value;
      }
    });
    return out;
  }

  for (const key of Object.keys(headers as Record<string, string>)) {
    const value = (headers as Record<string, unknown>)[key];
    const lower = key.toLowerCase();
    if (ALLOWED_RESPONSE_HEADERS.has(lower) && typeof value === "string") {
      out[lower] = value;
    }
  }
  return out;
}

export function parseRetryAfter(
  value: string | undefined | null,
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds)) return undefined;
    return Math.max(0, Math.round(seconds * 1000));
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

export type ProviderErrorParserInput = {
  response?: { status?: number; statusText?: string; url?: string };
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  bodyJson?: unknown;
  bodyText?: string;
  provider?: string;
  model?: string;
};

export type ProviderErrorParser = (
  input: ProviderErrorParserInput,
) => NormalizedProviderError;

export function readStringField(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

export function readStringOrNumberField(
  obj: unknown,
  key: string
): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const v = (obj as Record<string, unknown>)[key];
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export const parseProviderErrorGeneric: ProviderErrorParser = (input) => {
  const status = input.status ?? input.response?.status;
  const statusText = input.statusText ?? input.response?.statusText;
  const headers = input.headers ?? {};

  let message: string | undefined;
  let providerType: string | undefined;
  let providerCode: string | undefined;

  const body = input.bodyJson;
  if (body && typeof body === "object") {
    const root = body as Record<string, unknown>;
    const errVal = root.error;
    const errObj =
      errVal && typeof errVal === "object"
        ? (errVal as Record<string, unknown>)
        : undefined;

    message =
      readStringField(errObj, "message") ??
      readStringField(root, "message") ??
      (typeof errVal === "string" ? errVal : undefined);

    providerType =
      readStringField(errObj, "type") ??
      readStringField(root, "type") ??
      // Bedrock-style: top-level "__type" carries the exception class.
      readStringField(root, "__type") ??
      readStringField(errObj, "status");

    providerCode =
      // Accept numeric codes too (Gemini emits error.code: 400 as a number).
      readStringOrNumberField(errObj, "code") ??
      readStringOrNumberField(root, "code") ??
      readStringField(errObj, "status");
  }

  if (
    !message &&
    typeof input.bodyText === "string" &&
    input.bodyText.length > 0
  ) {
    message = input.bodyText;
  }

  const retryAfterRaw = headers["retry-after"] ?? headers["Retry-After"];
  const retryAfterMs = parseRetryAfter(retryAfterRaw);

  let retryable: boolean | undefined;
  if (typeof status === "number") {
    retryable =
      status === 408 || status === 429 || (status >= 500 && status < 600);
  }

  // Scrub every extracted string before exposing it. Providers can and do
  // echo Authorization headers, API keys, and signed values back to us in
  // their error responses.
  return {
    message: safeProviderString(message),
    providerType: safeProviderString(providerType),
    providerCode: safeProviderString(providerCode),
    status,
    statusText,
    retryable,
    retryAfterMs,
  };
};

export type LlmProviderHttpCode =
  | "llm.provider_rate_limited"
  | "llm.provider_auth_failed"
  | "llm.provider_invalid_request"
  | "llm.provider_unavailable"
  | "llm.provider_http_error";

export type EmbeddingProviderHttpCode =
  | "embedding.provider_rate_limited"
  | "embedding.provider_auth_failed"
  | "embedding.provider_invalid_request"
  | "embedding.provider_unavailable"
  | "embedding.provider_http_error";

export function statusToLlmProviderCode(status: number): LlmProviderHttpCode {
  if (status === 429) return "llm.provider_rate_limited";
  if (status === 401 || status === 403) return "llm.provider_auth_failed";
  if (status === 400 || status === 422) return "llm.provider_invalid_request";
  if (status === 408 || (status >= 500 && status < 600))
    return "llm.provider_unavailable";
  return "llm.provider_http_error";
}

export function statusToEmbeddingProviderCode(
  status: number,
): EmbeddingProviderHttpCode {
  if (status === 429) return "embedding.provider_rate_limited";
  if (status === 401 || status === 403) return "embedding.provider_auth_failed";
  if (status === 400 || status === 422)
    return "embedding.provider_invalid_request";
  if (status === 408 || (status >= 500 && status < 600))
    return "embedding.provider_unavailable";
  return "embedding.provider_http_error";
}
