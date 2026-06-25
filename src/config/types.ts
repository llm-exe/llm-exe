import type { configs } from "@/llm/config";
import type { CreateParserType } from "@/interfaces/parser";
import type { CoreExecutorExecuteOptions, LlmExecutorHooks } from "@/types";

/**
 * Serialization formats a config can arrive in. `auto` is best-effort
 * detection (JSON → YAML → markdown) for sources whose extension is unknown.
 */
export type Format = "json" | "yaml" | "markdown" | "auto";

/**
 * A `useLlm` provider key — e.g. "openai.chat.v1", "openai.gpt-4.1",
 * "openai.chat-mock.v1". NOT a friendly vendor name like "openai".
 */
export type ProviderKey = keyof typeof configs;

/**
 * Construction-time options for the executor (hooks, etc.). This is the
 * SECOND arg to `createLlm*Executor`, kept distinct from `executorOptions`
 * (which is execute-time state, the second arg to `.execute()`).
 *
 * `CoreExecutorExecuteOptions` now leads with the executor's I/O/R/HI type
 * params; the hook key set is the LAST param. A config-driven executor can't
 * know those concrete types, so they stay `any` and only the hook set is
 * pinned to `LlmExecutorHooks`.
 */
export type ExecutorCreateOptions = CoreExecutorExecuteOptions<
  any,
  any,
  any,
  any,
  LlmExecutorHooks
>;

/**
 * Canonical normalized config. The JSON Schema in `schema.ts` validates this
 * shape; every loader funnels into it via `normalizeConfig`.
 */
export interface ExecutorConfig {
  provider: ProviderKey;
  model?: string;
  system?: string;
  message: string;
  parser: CreateParserType;
  parserOptions?: Record<string, unknown>;
  llmOptions?: Record<string, unknown>;
  executorOptions?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/**
 * Runtime overrides applied over a parsed config. Precedence: caller (patch)
 * > file > defaults. `data` is deep-merged; every other field is replace-on-set.
 */
export interface ExecutorConfigPatch {
  data?: Record<string, unknown>;
  model?: string;
  provider?: ProviderKey;
  parser?: CreateParserType;
  parserOptions?: Record<string, unknown>;
  llmOptions?: Record<string, unknown>;
  executorOptions?: Record<string, unknown>;
  system?: string;
  message?: string;
}

/**
 * Per-run overrides for the terminal "run once" helpers (`runConfig`,
 * `runFile`). `data` deep-merges over `config.data`; `executorOptions`
 * shallow-merges over `config.executorOptions`.
 */
export interface RunOverrides {
  data?: Record<string, unknown>;
  executorOptions?: Record<string, unknown>;
}
