import { stateFromOptions } from "@/llm/_utils.stateFromOptions";
import {
  LlmExecutorWithFunctionsOptions,
  Config,
  ExecutionContext,
} from "@/types";
import { deepFreeze } from "@/utils/modules/deepFreeze";
import { backOff } from "exponential-backoff";
import { asyncCallWithTimeout } from "@/utils/modules/asyncCallWithTimeout";
import { emitDeprecationWarning } from "@/llm/_utils.deprecationWarning";
import { isLlmExeError } from "@/errors";
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
  "llm.provider_auth_failed",
  "llm.provider_invalid_request",
  "embedding.provider_auth_failed",
  "embedding.provider_invalid_request",
  "embedding.unsupported_input",
  "embedding.unsupported_dimensions",
]);

export function apiRequestWrapper<T extends Record<string, any>, I>(
  config: Config<any>,
  options: Record<string, any>,
  handler: (_s: any, _i: I, o?: any) => Promise<T>,
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
  const timeout: number = options.timeout || 30000;

  /**
   * The maximum delay (in milliseconds) between retries.
   */
  const maxDelay: number = options.maxDelay || 5000;

  /**
   * The maximum number of retries before giving up.
   */
  const numOfAttempts: number = options.numOfAttempts || 2;

  /**
   * The jitter strategy to use between retries. Options are "none" or "full".
   */
  const jitter: "none" | "full" = options.jitter || "none";

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
      const result = await backOff<T>(
        () =>
          asyncCallWithTimeout(
            handler(
              deepFreeze(state),
              deepFreeze(messages),
              deepFreeze(options)
            ),
            timeout
          ),
        {
          startingDelay: 0,
          maxDelay: maxDelay,
          numOfAttempts: numOfAttempts,
          jitter: jitter,
          retry: (_error: any, _stepNumber: number) => {
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
            return true;
          },
        }
      );
      metrics.total_call_success++;
      return result;
    } catch (error) {
      metrics.total_call_error++;
      throw error;
    }
  }

  function getMetadata() {
    const {
      awsSecretKey,
      awsAccessKey,
      openAiApiKey,
      anthropicApiKey,
      ...rest
    } = options;
    return Object.assign(
      {
        traceId: getTraceId(),
        timeout: timeout,
        jitter: jitter,
        maxDelay: maxDelay,
        numOfAttempts: numOfAttempts,
        metrics: { ...metrics },
      },
      rest
    );
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
