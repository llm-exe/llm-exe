import { validate as runJsonSchema } from "jsonschema";
import type { ExecutorConfig } from "./types";
import { configInvalidError } from "./errors";

/**
 * Canonical JSON Schema for a normalized executor config.
 *
 * `provider` and `parser` are plain strings here on purpose: the schema is a
 * static literal and cannot express `keyof typeof configs`, and `createParser`
 * is the single source of truth for parser-name validity. `normalizeConfig`
 * does the runtime `provider in configs` check (better error); `createParser`
 * throws on a bad parser name at assembly time.
 */
export const executorConfigSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["provider", "message"],
  additionalProperties: false,
  properties: {
    provider: { type: "string", minLength: 1 },
    model: { type: "string" },
    system: { type: "string" },
    message: { type: "string", minLength: 1 },
    parser: { type: "string", minLength: 1 },
    parserOptions: { type: "object" },
    llmOptions: { type: "object" },
    executorOptions: { type: "object" },
    data: { type: "object" },
  },
} as const;

/**
 * Validate a candidate config against the schema, mapping jsonschema's coarse
 * errors to a single `configuration.invalid_config` with a readable field list.
 * Returns the input typed as `ExecutorConfig` on success.
 */
export function validate(input: unknown): ExecutorConfig {
  const result = runJsonSchema(input, executorConfigSchema as object);
  if (!result.valid) {
    const schemaErrors = result.errors.map((error) => {
      const field = error.property.replace(/^instance\.?/, "") || "(root)";
      return `${field} ${error.message}`;
    });
    throw configInvalidError({
      schemaErrors,
      field: result.errors[0]?.property.replace(/^instance\.?/, ""),
      expected: result.errors[0]?.argument,
      received: input,
    });
  }
  return input as ExecutorConfig;
}
