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

// `LlmExecutorWithFunctions` extends `LlmExecutor`, so the base type covers
// both branches. The base is used so `.execute(input)` accepts a single
// argument; the function subclass requires a second.
type AnyConfigExecutor = LlmExecutor<any, any, any, any>;

/**
 * Validate and normalize a config object into an `ExecutorConfig`. Browser-safe.
 *
 * Public alias for the internal `normalizeConfig` (which is not exported). The
 * exported name matches the `parseExecutorConfig` / `executorFromConfig` family
 * and decouples the public API from the internal signature.
 */
export function loadExecutorConfig(
  object: unknown,
  patch?: ExecutorConfigPatch
): ExecutorConfig {
  return normalizeConfig(object, patch);
}

/**
 * Build a native `LlmExecutor` from a config. `createOptions` sets
 * construction-time options such as hooks. `executorOptions` is not applied
 * here; the caller passes it at execute time via `.execute(input, options)`.
 * An `executorOptions.functions` array selects the function-calling executor.
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
 * Run a config once. Deep-merges `overrides.data` over `config.data` and
 * shallow-merges `overrides.executorOptions` over `config.executorOptions`,
 * then executes. `executorOptions` is passed to `.execute()`, which is where a
 * function executor receives its `functions`.
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
