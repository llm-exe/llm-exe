export { useExecutors, createCallableExecutor } from "@/plugins/callable";
export {
  createCoreExecutor,
  createLlmExecutor,
  createLlmFunctionExecutor,
} from "@/executor/_functions";
export { BaseExecutor } from "@/executor/_base";
export * as utils from "./utils";
export * as guards from "./utils/guards";
export {
  useLlm,
  useLlmConfiguration,
  createOpenAiCompatibleConfiguration,
} from "./llm";
export { createEmbedding } from "./embedding/embedding";

export {
  BasePrompt,
  ChatPrompt,
  TextPrompt,
  createPrompt,
  createChatPrompt,
} from "@/prompt";

export {
  BaseParser,
  CustomParser,
  OpenAiFunctionParser,
  LlmNativeFunctionParser,
  createParser,
  createCustomParser,
} from "./parser";

export {
  DefaultState,
  BaseStateItem,
  DefaultStateItem,
  createState,
  createStateItem,
  createDialogue,
} from "./state";

export {
  LlmExecutorWithFunctions,
  LlmExecutorOpenAiFunctions,
} from "@/executor/llm-openai-function";

export { defineSchema } from "./utils/modules/defineSchema";
export { registerHelpers, registerPartials } from "./utils";

// Config/file execution layer — browser-safe surface only. File loading
// (executorFromFile/loadConfigFromFile/runFile) is the `llm-exe/node` subpath.
export {
  loadExecutorConfig,
  parseExecutorConfig,
  executorFromConfig,
  runConfig,
  loadConfigFromUrl,
} from "@/config";
export type {
  ExecutorConfig,
  ExecutorConfigPatch,
  Format,
} from "@/config/types";
export type { CreateParserType } from "@/interfaces/parser";

export { LlmExeError, LLM_EXE_ERROR_SYMBOL } from "./errors/LlmExeError";
export { isLlmExeError } from "./errors/isLlmExeError";
export { serializeLlmExeError } from "./errors/serialize";
export { formatLlmExeErrorForLog } from "./errors/format";
export type {
  ErrorCategory,
  ErrorCodes,
  ErrorContextByCode,
  NormalizedProviderError,
  ProviderErrorContext,
} from "./errors/types";

export type {
  LlmProvider,
  BaseLlm,
  OpenAIModelName,
  IChatMessages,
  ExecutorContext,
  ExecutionContext,
  ExecutorExecutionMetadata,
  HookErrorRecord,
  LlmProviderKey,
  EmbeddingProviderKey,
  UseLlmKey,
  JsonParserMatch,
  JsonParserOptions,
} from "./interfaces";

export type {
  BooleanParserMatch,
  BooleanParserOptions,
  NumberParserMatch,
  NumberParserOptions,
  StringExtractMatch,
  StringExtractParserOptions,
} from "./parser";
