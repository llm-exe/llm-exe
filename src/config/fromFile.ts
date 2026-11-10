import { readFile } from "node:fs/promises";
import { executorFromConfig, runConfig } from "./assemble";
import { parseExecutorConfig, formatFromExtension } from "./parse";
import { configFileNotFoundError, configFileReadFailedError } from "./errors";
import type {
  ExecutorConfig,
  ExecutorConfigPatch,
  ExecutorCreateOptions,
  RunOverrides,
} from "./types";

/**
 * Read and normalize a config from a file path. Format is inferred from the
 * extension, falling back to "auto". NODE-ONLY (`node:fs/promises`) — reached
 * via the `llm-exe/node` subpath, never from the browser-safe root barrel.
 */
export async function loadConfigFromFile(
  path: string,
  patch?: ExecutorConfigPatch
): Promise<ExecutorConfig> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (cause) {
    const err = cause as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      throw configFileNotFoundError({ path }, { cause });
    }
    throw configFileReadFailedError(
      { path, syscall: err?.syscall, errno: err?.code },
      { cause }
    );
  }

  const format = formatFromExtension(path) ?? "auto";
  return parseExecutorConfig(text, { format, ...(patch ?? {}) });
}

/** Assemble a native executor from a config file. Mirrors `executorFromConfig`. */
export async function executorFromFile(
  path: string,
  patch?: ExecutorConfigPatch,
  createOptions?: ExecutorCreateOptions
) {
  return executorFromConfig(await loadConfigFromFile(path, patch), createOptions);
}

/** Run a config file once, binding config defaults. The CLI's primitive. */
export async function runFile(
  path: string,
  patch?: ExecutorConfigPatch,
  overrides?: RunOverrides,
  createOptions?: ExecutorCreateOptions
): Promise<unknown> {
  return runConfig(await loadConfigFromFile(path, patch), overrides, createOptions);
}
