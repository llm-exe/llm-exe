import { get } from "@/utils/modules/get";
import { Config, GenericLLm, LlmProvider, LlmProviderKey } from "@/types";
import { pick } from "@/utils/modules/pick";
import { LlmExeError } from "@/errors";

/**
 * Marks, on the produced state object, which declared option keys the CALLER
 * actually supplied (a defined value) as opposed to keys that were filled from
 * `config.options[key].default` by the loop below.
 *
 * mapBody transforms otherwise cannot tell "the user set maxTokens to 4096" from
 * "we defaulted maxTokens to 4096" once defaults are applied, which is the
 * provenance gap behind issue #712 (and the #661 note in this file). Keyed by a
 * Symbol and attached non-enumerably so it never appears in Object.keys /
 * JSON.stringify / equality checks and can never leak into an outgoing request
 * body. `*.call.ts` re-attaches it enumerably onto the mapBody input body so
 * transforms can read it from their frozen state argument.
 */
export const PROVIDED_OPTION_KEYS = Symbol("llm-exe.providedOptionKeys");

export function stateFromOptions(options: Partial<GenericLLm>, config: Config) {
  const optionsKeys = Object.keys(config.options) as (keyof typeof options)[];

  // Snapshot provenance from the raw options BEFORE the default-fill loop below
  // overwrites undefined values: a declared key counts as caller-provided only
  // when the caller passed a defined value for it.
  const providedKeys = new Set<string>(
    optionsKeys
      .filter((key) => typeof options[key] !== "undefined")
      .map((key) => String(key)),
  );

  const state = Object.assign(pick(options, optionsKeys), {
    provider: config.provider,
    key: config.key,
    model: options.model,
  }) as unknown as GenericLLm & { provider: LlmProvider; key: LlmProviderKey };

  const keys = Object.keys(config.options) as (keyof typeof config.options)[];

  for (const key of keys) {
    const thisConfig = config.options[key];
    const thisValue = get(state, key);
    if (typeof thisValue === "undefined") {
      if (typeof thisConfig?.default !== "undefined") {
        (state as any)[key] = thisConfig.default;
      }
    }

    const value = get(state, key);

    if (Array.isArray(thisConfig?.required)) {
      const [required, message = `Error: [${key}] is required`] =
        thisConfig.required;

      if (required && typeof value === "undefined") {
        // Note: this always emits configuration.missing_option, even when the
        // option's default was sourced from an environment variable. The
        // current Config shape resolves env defaults eagerly into a value, so
        // by the time we reach this branch we cannot tell whether the missing
        // value was supposed to come from the user's options or from env.

        // TODO: Distinguishing missing_env requires adding env-source metadata to
        // the Config.options entry.
        throw new LlmExeError(message, {
          code: "configuration.missing_option",
          context: {
            operation: "stateFromOptions",
            provider: config.provider,
            key: config.key,
            option: String(key),
            resolution: `Provide a value for "${String(key)}" via options or environment.`,
          },
        });
      }
    }
  }

  Object.defineProperty(state, PROVIDED_OPTION_KEYS, {
    value: providedKeys,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return state;
}
