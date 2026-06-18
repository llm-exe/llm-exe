import { useLlm } from "@/llm/llm";
import { createChatPrompt } from "@/prompt/_functions";
import { createParser } from "@/parser/_functions";
import {
  createLlmExecutor,
  createLlmFunctionExecutor,
} from "@/executor/_functions";
import type { LlmExecutor } from "@/executor/llm";
import { normalizeConfig, mergeData } from "./normalize";
import type {
  ExecutorConfig,
  ExecutorConfigPatch,
  ExecutorCreateOptions,
  RunOverrides,
} from "./types";

// Both branches are `LlmExecutor` — `LlmExecutorWithFunctions extends
// LlmExecutor`. Typing the return as the base is the true common supertype
// (NOT a downcast): it matches what `createLlmExecutor` returns, so this stays
// a drop-in, and `.execute(input)` works without forcing a second arg (the
// function subclass narrows `execute`'s options to required, which would leak
// onto every caller if we returned the union). Functions are still delivered
// at execute-time via `executorOptions`; the runtime instance is unchanged.
type AnyConfigExecutor = LlmExecutor<any, any, any, any>;

/**
 * Normalize an in-memory object into a validated `ExecutorConfig`.
 * Browser-safe. Identical to `normalizeConfig`, named for the public surface.
 */
export function loadExecutorConfig(
  object: unknown,
  patch?: ExecutorConfigPatch
): ExecutorConfig {
  return normalizeConfig(object, patch);
}

/**
 * Assemble a native executor from a config. This is the extracted `run.ts`
 * body — it returns the SAME class the hand-written code path returns, with no
 * wrapper type. `createOptions` carries hooks/debug (construction-time);
 * `executorOptions` is NOT bound here — it is execute-time state the caller
 * passes per `.execute(input, executorOptions)` call.
 */
export function executorFromConfig(
  config: ExecutorConfig,
  createOptions?: ExecutorCreateOptions
): AnyConfigExecutor {
  const llmOptions = {
    ...config.llmOptions,
    ...(config.model ? { model: config.model } : {}),
  };
  const llm = useLlm(config.provider, llmOptions as any);

  const prompt = createChatPrompt(config.system || "", {
    allowUnsafeUserTemplate: true,
  });
  prompt.addUserMessage(config.message);

  const parser = createParser(
    config.parser as any,
    config.parserOptions as any
  );

  const llmConfiguration = { llm, prompt, parser } as any;

  const hasFunctions = Array.isArray(
    (config.executorOptions as Record<string, unknown> | undefined)?.functions
  );

  return hasFunctions
    ? createLlmFunctionExecutor(llmConfiguration, createOptions)
    : createLlmExecutor(llmConfiguration, createOptions);
}

/**
 * Terminal "run once" helper. Binds config defaults — deep-merges
 * `overrides.data` over `config.data`, shallow-merges `overrides.executorOptions`
 * over `config.executorOptions` — then executes. This is the ONLY place config
 * defaults are bound; `executorFromConfig` leaves them to the caller.
 *
 * `config.executorOptions` MUST flow to `.execute()` (not construction) — that
 * is where the function-executor's `functions` array is delivered.
 */
export function runConfig(
  config: ExecutorConfig,
  overrides?: RunOverrides,
  createOptions?: ExecutorCreateOptions
): Promise<unknown> {
  const executor = executorFromConfig(config, createOptions);
  const data = mergeData(config.data, overrides?.data) ?? {};
  const executorOptions = {
    ...config.executorOptions,
    ...overrides?.executorOptions,
  };
  return executor.execute(data as any, executorOptions);
}
