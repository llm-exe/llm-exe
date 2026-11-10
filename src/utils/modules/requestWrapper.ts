import {
  PROVIDED_OPTION_KEYS,
  stateFromOptions,
} from "@/llm/_utils.stateFromOptions";
import {
  LlmExecutorWithFunctionsOptions,
  Config,
  ExecutionContext,
} from "@/types";
import { deepFreeze } from "@/utils/modules/deepFreeze";
import { deepClone } from "@/utils/modules/deepClone";
import { backOff } from "exponential-backoff";
import { asyncCallWithTimeout } from "@/utils/modules/asyncCallWithTimeout";
import { emitDeprecationWarning } from "@/llm/_utils.deprecationWarning";
import { isLlmExeError, LlmExeError } from "@/errors";
import type { ErrorCategory, ErrorCodes } from "@/errors";

// const doNotRetryErrorMessages: string[] = [];

// LlmExeError categories that are deterministic client-side failures — bad
// config/options, an invalid prompt, or missing auth inputs. Retrying cannot fix
// these, so short-circuit backOff and surface them on the first attempt instead
// of burning numOfAttempts (and any delay) on a guaranteed re-failure. Typed as
// Set<ErrorCategory> so a mistyped category is a compile error, not a silent miss.
const NON_RETRYABLE_CATEGORIES = new Set<ErrorCategory>([
  "configuration",
  "prompt",
  "auth",
]);

// Deterministic LlmExeError codes that live in an otherwise-mixed category
// (llm.* and embedding.* also carry transient rate_limited/unavailable codes),
// so the category short-circuit above can't reach them. A bad key, a 400, or an
// unsupported input/dimensions request re-fails identically on retry. Typed as
// Set<ErrorCodes> so a mistyped code is a compile error, not a silent miss.
// (embedding.missing_provider / invalid_provider are intentionally absent — they
// throw at createEmbedding() construction, before the wrapper exists, so they
// never reach this predicate.)
const NON_RETRYABLE_CODES = new Set<ErrorCodes>([
  // A client timeout does not stop provider generation; retrying can bill twice.
  "request.timeout",
  "llm.provider_auth_failed",
  "llm.provider_invalid_request",
  "embedding.provider_auth_failed",
  "embedding.provider_invalid_request",
  "embedding.unsupported_input",
  "embedding.unsupported_dimensions",
]);

// Base delay (ms) before the first retry. exponential-backoff doubles it on
// each subsequent retry and caps it at maxDelay. Must be non-zero: with 0,
// every computed delay is 0 and maxDelay has no effect.
const STARTING_DELAY_MS = 500;
const TIME_MULTIPLE = 2;

function readRetryAfterMs(error: unknown): number | undefined {
  if (!isLlmExeError(error)) return undefined;
  const providerError = (error.context as { providerError?: unknown })
    ?.providerError;
  if (!providerError || typeof providerError !== "object") return undefined;
  const value = (providerError as { retryAfterMs?: unknown }).retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Option names that look like credentials. Catches keys that never appear in
// the headers template (e.g. google's `?key={{geminiApiKey}}`, aws signing keys).
// Deliberately excludes bare "token" so `maxTokens` is not dropped.
const CREDENTIAL_OPTION_PATTERN = /api_?key|secret|access_?key|password/i;

// Options interpolated into the headers template carry auth (Authorization,
// x-api-key, ...), so any option name referenced there is treated as a secret.
// This covers custom `apiKeyMapping` names that don't match the pattern above.
function headerTemplateOptionKeys(config: Config<any>): Set<string> {
  const headers = typeof config?.headers === "string" ? config.headers : "";
  return new Set(
    Array.from(headers.matchAll(/{{\s*([\w.]+)\s*}}/g), (m) => m[1])
  );
}

export function apiRequestWrapper<T extends Record<string, any>, I>(
  config: Config<any>,
  options: Record<string, any>,
  handler: (_s: any, _i: I, o?: any, signal?: AbortSignal) => Promise<T>,
  doNotRetryErrorMessages: string[] = []
) {
  const state = stateFromOptions(options, config);

  const metrics: any = {
    total_calls: 0,
    total_call_success: 0,
    total_call_retry: 0,
    total_call_error: 0,
    history: [],
  };

  /**
   * The maximum time (in milliseconds) to wait for a response before timing out.
   */
  const timeout: number = resolveRequestOption(
    options.timeout,
    30000,
    "timeout",
    (value) => value > 0,
    "a finite number greater than 0"
  );

  /**
   * The maximum delay (in milliseconds) between retries.
   */
  const maxDelay: number = resolveRequestOption(
    options.maxDelay,
    5000,
    "maxDelay",
    (value) => value >= 0,
    "a finite number greater than or equal to 0"
  );

  /**
   * The maximum number of retries before giving up.
   */
  const numOfAttempts: number = resolveRequestOption(
    options.numOfAttempts,
    2,
    "numOfAttempts",
    (value) => value > 0,
    "a finite number greater than 0"
  );

  /**
   * The jitter strategy to use between retries. Options are "none" or "full".
   */
  const jitter: "none" | "full" = options.jitter || "none";

  const startingDelay = Math.min(STARTING_DELAY_MS, maxDelay);

  let traceId: null | string = options?.traceId || null;

  async function call(
    messages: I,
    options?: LlmExecutorWithFunctionsOptions,
    context?: ExecutionContext
  ) {
    try {
      emitDeprecationWarning(config, {
        executorName: context?.executor?.name,
        traceId: context?.traceId ?? getTraceId() ?? undefined,
      });
      metrics.total_calls++;
      const clonedState = deepClone(state);
      const providedOptionKeys = Reflect.get(state, PROVIDED_OPTION_KEYS);
      if (providedOptionKeys !== undefined) {
        Reflect.set(clonedState, PROVIDED_OPTION_KEYS, providedOptionKeys);
      }
      const frozenState = deepFreeze(clonedState);
      const frozenMessages = deepFreeze(deepClone(messages));
      const frozenOptions = deepFreeze(deepClone(options));
      const result = await backOff<T>(
        () => {
          const abortController = new AbortController();
          return asyncCallWithTimeout(
            handler(
              frozenState,
              frozenMessages,
              frozenOptions,
              abortController.signal,
            ),
            timeout,
            abortController,
          );
        },
        {
          startingDelay,
          timeMultiple: TIME_MULTIPLE,
          maxDelay: maxDelay,
          numOfAttempts: numOfAttempts,
          jitter: jitter,
          retry: async (_error: any, _stepNumber: number) => {
            if (doNotRetryErrorMessages.includes(_error.message)) {
              return false;
            }
            if (
              isLlmExeError(_error) &&
              (NON_RETRYABLE_CATEGORIES.has(_error.category) ||
                NON_RETRYABLE_CODES.has(_error.code))
            ) {
              return false;
            }
            metrics.total_call_retry++;
            // No retry happens once the attempt limit is reached, so don't
            // wait for retry-after in that case.
            if (_stepNumber >= numOfAttempts) {
              return true;
            }
            // Follow the provider's retry-after (capped at maxDelay, so one
            // header can't stall a call). backOff then applies its own delay
            // for this retry, so only sleep for the part retry-after adds on
            // top of it.
            const retryAfterMs = readRetryAfterMs(_error);
            if (retryAfterMs !== undefined) {
              const backoffDelay = Math.min(
                startingDelay * Math.pow(TIME_MULTIPLE, _stepNumber - 1),
                maxDelay
              );
              const extra = Math.min(retryAfterMs, maxDelay) - backoffDelay;
              if (extra > 0) {
                await sleep(extra);
              }
            }
            return true;
          },
        },
      );
      metrics.total_call_success++;
      return result;
    } catch (error) {
      metrics.total_call_error++;
      throw error;
    }
  }

  function getMetadata() {
    const headerKeys = headerTemplateOptionKeys(config);
    const rest = Object.fromEntries(
      Object.entries(options).filter(
        ([key]) => !CREDENTIAL_OPTION_PATTERN.test(key) && !headerKeys.has(key)
      )
    );
    return {
      ...rest,
      traceId: getTraceId(),
      timeout,
      jitter,
      maxDelay,
      numOfAttempts,
      metrics: { ...metrics },
    };
  }

  function getTraceId() {
    return traceId;
  }

  function withTraceId(id: string) {
    traceId = id;
  }

  return {
    call,
    getTraceId,
    withTraceId,
    getMetadata,
  };
}

function resolveRequestOption(
  value: unknown,
  defaultValue: number,
  option: string,
  isValid: (value: number) => boolean,
  expected: string,
): number {
  const resolved = value ?? defaultValue;
  if (
    typeof resolved !== "number" ||
    !Number.isFinite(resolved) ||
    !isValid(resolved)
  ) {
    throw new LlmExeError(
      `Invalid ${option}: expected ${expected}, received ${String(resolved)}`,
      {
        code: "configuration.incompatible_options",
        context: {
          operation: "apiRequestWrapper",
          option,
          received: resolved,
          expected,
          resolution: `Set ${option} to ${expected}.`,
        }
      }
    );
  }
  return resolved;
}
