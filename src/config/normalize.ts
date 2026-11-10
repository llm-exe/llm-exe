import { configs } from "@/llm/config";
import type { ExecutorConfig, ExecutorConfigPatch } from "./types";
import { validate } from "./schema";
import { configInvalidError } from "./errors";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const PATCH_REPLACE_FIELDS = [
  "model",
  "provider",
  "parser",
  "parserOptions",
  "llmOptions",
  "executorOptions",
  "system",
  "message",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = base[key];
  }
  for (const key of Object.keys(override)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const next = override[key];
    if (next === undefined) continue; // do not clobber with undefined
    const prev = out[key];
    if (isPlainObject(next)) {
      // recurse so forbidden keys are stripped at every level, base or override
      out[key] = deepMerge(isPlainObject(prev) ? prev : {}, next);
    } else {
      out[key] = next; // arrays, primitives, and null replace
    }
  }
  return out;
}

/**
 * Deep-merge override data over base data. Plain objects merge recursively,
 * arrays replace, `undefined` is ignored, `null` replaces. `__proto__` /
 * `constructor` / `prototype` keys are stripped at every level — load-bearing
 * because configs can be remote (`loadConfigFromUrl`).
 */
export function mergeData(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (override === undefined) return base;
  if (base === undefined) return deepMerge({}, override);
  return deepMerge(base, override);
}

/**
 * Normalize a raw parsed config into a validated `ExecutorConfig`.
 * - `output` is an accepted alias for `parser` (canonicalized away).
 * - `patch` is applied caller > file; `data` deep-merges, all else replaces.
 * - `parser` defaults to "string".
 * - throws `configuration.invalid_config` on schema/provider/message failure.
 */
export function normalizeConfig(
  raw: unknown,
  patch?: ExecutorConfigPatch
): ExecutorConfig {
  if (!isPlainObject(raw)) {
    throw configInvalidError({
      field: "(root)",
      expected: "object",
      received: raw,
    });
  }

  const merged: Record<string, unknown> = { ...raw };

  // `output` → `parser` alias. `parser` wins if both are present.
  if ("output" in merged) {
    if (merged.parser === undefined && merged.output !== undefined) {
      merged.parser = merged.output;
    }
    delete merged.output;
  }

  if (patch) {
    for (const field of PATCH_REPLACE_FIELDS) {
      if (patch[field] !== undefined) {
        merged[field] = patch[field];
      }
    }
    if (patch.data !== undefined) {
      merged.data = mergeData(
        isPlainObject(merged.data) ? merged.data : undefined,
        patch.data
      );
    }
  }

  if (merged.parser === undefined) {
    merged.parser = "string";
  }

  // schema guarantees provider/message are non-empty strings and types match
  const config = validate(merged);

  if (!(config.provider in configs)) {
    throw configInvalidError({
      field: "provider",
      received: config.provider,
      availableProviders: Object.keys(configs),
    });
  }

  if (config.message.trim() === "") {
    throw configInvalidError({
      field: "message",
      expected: "non-empty string",
      received: config.message,
    });
  }

  return config;
}
