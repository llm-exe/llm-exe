import { get } from "@/utils/modules/get";
import { Config, GenericLLm, LlmProvider, LlmProviderKey } from "@/types";
import { pick } from "@/utils/modules/pick";
import { LlmExeError } from "@/errors";

export function stateFromOptions(options: Partial<GenericLLm>, config: Config) {
  const optionsKeys = Object.keys(config.options) as (keyof typeof options)[];
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

  return state;
}
