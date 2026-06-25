import { BaseParser } from "@/parser";
import { BasePrompt } from "@/prompt";
import { PlainObject } from "./utils";
import { BaseExecutor } from "@/executor";
import { hookOnComplete, hookOnError, hookOnSuccess } from "@/utils/const";

export type ListenerFunction = (...args: any[]) => void;

export type ParserOutput<P> = P extends BaseParser<infer T, any> ? T : never;
export type ParserInput<P> = P extends BaseParser<any, infer T> ? T : never;
export type PromptInput<P> = P extends BasePrompt<infer T> ? T : never;

export interface ExecutorWithLlmOptions<Llm, Prompt, Parser, State> {
  name?: string;
  llm: Llm;
  prompt: Prompt | ((values: PromptInput<Prompt>) => Prompt);
  parser?: Parser;
  state?: State;
  // maybe temp?
  __mock_response_key__?: string;
}

export interface CoreExecutorInput<I, O> {
  name?: string;
  handler: (input: I) => Promise<O> | O;
  getHandlerInput?(input: I): Promise<any>;
  getHandlerOutput?(out: any): O;
}

export type FunctionOrExecutor<I extends PlainObject | { input: string }, O> =
  | ((input: I) => Promise<O> | O)
  | BaseExecutor<I, O>;

export interface ExecutorMetadata {
  id: string;
  type: string;
  name: string;
  created: number;
  executions: number;
  metadata?: Record<string, any>;
}

export interface HookErrorRecord {
  hook: string;
  // The raw thrown value, preserved verbatim. this is the only place 
  // a non-LlmExe hook failure (stack/name/etc.) is recoverable. 
  // Consumers can `instanceof Error`-check or pull fields.
  error: unknown;
  errorMessage: string;
  errorCategory?: string;
  errorCode?: string;
  errorContext?: unknown;
  errorCause?: unknown;
}

export interface ExecutorExecutionMetadata<
  I = any,
  O = any,
  R = any,
  HI = any,
> {
  start: null | number;
  end: null | number;
  input: I;
  // The handler's resolved input. For LLM executors this is the formatted
  // prompt — `IChatMessages` for chat prompts, `string` for text prompts.
  // Defaults to `any` for executors that don't pin it.
  handlerInput?: HI;
  // Raw, pre-parse handler return. For LLM executors this is the normalized
  // `BaseLlCall`, so hooks can reach `handlerOutput.getResult().usage` with
  // full types. Defaults to `any` for executors that don't pin it.
  handlerOutput?: R;
  output?: O;
  errorMessage?: string;
  error?: Error;
  // Structured fields populated when the caught error is an LlmExeError.
  // `error` and `errorMessage` are preserved for back-compat.
  errorCategory?: string;
  errorCode?: string;
  errorContext?: unknown;
  errorCause?: unknown;
  // Captured failures from user-supplied hook callbacks (onSuccess, onError).
  // onComplete-hook failures cannot land here because nothing runs after them.
  hookErrors?: HookErrorRecord[];
  metadata?: null | ExecutorMetadata;
}

export type ExecutorExecutionMetadataProperties = Pick<
  ExecutorExecutionMetadata,
  | "start"
  | "end"
  | "input"
  | "handlerInput"
  | "handlerOutput"
  | "output"
  | "errorMessage"
  | "error"
  | "errorCategory"
  | "errorCode"
  | "errorContext"
  | "errorCause"
  | "hookErrors"
  | "metadata"
>;

export interface ExecutorContext<I = any, O = any, A = Record<string, any>>
  extends ExecutorExecutionMetadata<I, O> {
  metadata: ExecutorMetadata;
  attributes: A;
}

/**
 * Per-call execution context. Built by `BaseExecutor.execute()` and threaded
 * through `handler()`, `llm.call()`, parsers, and warnings. Provides a single
 * place to read the resolved trace ID, stable executor identity, and the
 * mutable execution state for the current run.
 */
export interface ExecutionContext<I = any, O = any, A = Record<string, any>> {
  traceId?: string;
  executor: ExecutorMetadata;
  execution: ExecutorExecutionMetadata<I, O>;
  attributes: A;
}

export interface BaseExecutorHooks {
  [hookOnError]: ListenerFunction[];
  [hookOnSuccess]: ListenerFunction[];
  [hookOnComplete]: ListenerFunction[];
}

export interface LlmExecutorHooks extends BaseExecutorHooks {
  /**
   * If needed, can override allowedHooks on llmExecutor
   * and add llm-specific hooks here
   */
}

/**
 * A single executor hook callback. Receives the per-run execution metadata
 * (input/output/error fields typed via I/O) followed by the executor's own
 * identity metadata. This is the shape fired for onSuccess / onError /
 * onComplete — the metadata fields that are populated differ per event
 * (`output` on success, `error` on failure), but all are optional on
 * {@link ExecutorExecutionMetadata}, so one signature covers every hook.
 */
export type ExecutorHookFunction<I = any, O = any, R = any, HI = any> = (
  metadata: ExecutorExecutionMetadata<I, O, R, HI>,
  executor: ExecutorMetadata
) => void;

// Generic order mirrors `BaseExecutor<I, O, H, R, HI>` so call sites pass the
// class type params straight through without reordering. `H` (the hook key
// set) stays in position 3 to match the public, back-compat-frozen
// `BaseExecutor` signature.
export type CoreExecutorHookInput<
  I = any,
  O = any,
  H = BaseExecutorHooks,
  R = any,
  HI = any,
> = {
  [key in keyof H]?:
    | ExecutorHookFunction<I, O, R, HI>
    | ExecutorHookFunction<I, O, R, HI>[];
};

export interface CoreExecutorExecuteOptions<
  I = any,
  O = any,
  H = BaseExecutorHooks,
  R = any,
  HI = any,
> {
  hooks?: CoreExecutorHookInput<I, O, H, R, HI>;
}

export interface CallableExecutorCore {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface LlmExecutorExecuteOptions {
  functions?: CallableExecutorCore[];
  functionCall?: any;
  jsonSchema?: Record<string, any>;
}

export type GenericFunctionCall = "auto" | "none" | "any" | { name: string };

export interface LlmExecutorWithFunctionsOptions<
  T extends GenericFunctionCall = "auto",
> extends LlmExecutorExecuteOptions {
  functions?: CallableExecutorCore[];
  functionCall?: T;
  functionCallStrictInput?: boolean;
  jsonSchema?: Record<string, any>;
}
