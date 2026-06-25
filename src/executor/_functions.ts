import {
  BaseLlm,
  PlainObject,
  ExecutorWithLlmOptions,
  CoreExecutorExecuteOptions,
  ExecutionContext,
  LlmExecutorHooks,
} from "@/types";
import { BaseParser } from "@/parser";
import { BasePrompt } from "@/prompt";
import { BaseState } from "@/state";
import { CoreExecutor } from "./core";
import { LlmExecutor } from "./llm";
import { LlmExecutorWithFunctions } from "./llm-openai-function";

/**
 * Function to create a core executor.
 * @template I - Input type.
 * @template O - Output type.
 * @param handler - The handler function.
 * @returns - A new CoreExecutor instance.
 */
export function createCoreExecutor<I extends PlainObject, O>(
  handler: (input: I, context?: ExecutionContext<I, O>) => Promise<O> | O,
  options?: CoreExecutorExecuteOptions
) {
  return new CoreExecutor<I, O>({ handler }, options);
}

/**
 * Function to create a core executor with Llm.
 * @template Llm - Llm type.
 * @template Prompt - Prompt type.
 * @template Parser - Parser type.
 * @template State - State type.
 * @param options - Options for BaseExecutorV3.
 * @returns  - A new LlmExecutor instance.
 */
export function createLlmExecutor<
  Llm extends BaseLlm<any>,
  Prompt extends BasePrompt<any>,
  Parser extends BaseParser,
  State extends BaseState,
>(
  llmConfiguration: ExecutorWithLlmOptions<Llm, Prompt, Parser, State>,
  options?: CoreExecutorExecuteOptions<LlmExecutorHooks>
) {
  return new LlmExecutor<Llm, Prompt, Parser, State>(llmConfiguration, options);
}

export function createLlmFunctionExecutor<
  Llm extends BaseLlm,
  Prompt extends BasePrompt<Record<string, any>>,
  Parser extends BaseParser,
  State extends BaseState,
>(
  llmConfiguration: ExecutorWithLlmOptions<Llm, Prompt, Parser, State>,
  options?: CoreExecutorExecuteOptions<LlmExecutorHooks>
) {
  return new LlmExecutorWithFunctions<Llm, Prompt, Parser, State>(
    llmConfiguration,
    options
  );
}
