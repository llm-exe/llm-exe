import { configs, getLlmConfig } from "@/llm/config";
import { useLlm_call } from "@/llm/llm.call";
import { apiRequestWrapper } from "@/utils/modules/requestWrapper";
import { AllUseLlmOptions, BaseLlm, Config } from "@/types";

export function useLlm<T extends keyof typeof configs>(
  provider: T,
  options: AllUseLlmOptions[T]["input"] = {},
): BaseLlm {
  const config = getLlmConfig(provider);
  return useLlmConfiguration<T>(config)(options);
}

/**
 * Options declared on a config literal (e.g. `options: { region: {} }`).
 * Resolves to `never` when the keys are only known as `string` (a config
 * typed as plain `Config`) or when there are none (`options: {}`). In both
 * cases the config adds nothing to the accepted options; an empty mapped
 * type `{}` would otherwise accept any object.
 */
type ConfigDeclaredOptions<O> = string extends keyof O
  ? never
  : [keyof O] extends [never]
    ? never
    : { [K in keyof O]?: unknown };

export function useLlmConfiguration<
  T extends keyof typeof configs,
  O extends Config<any>["options"] = Config<any>["options"],
>(
  // Only `options` is generic. Inferring the whole config as a type parameter
  // would skip excess-property checks on the literal, so a misspelled
  // top-level key such as `endpont` would compile.
  config: Config<any> & { options: O },
) {
  return <
    Options extends AllUseLlmOptions[T]["input"] | ConfigDeclaredOptions<O>,
  >(
    options?: Options,
  ) =>
    apiRequestWrapper(
      config,
      options ?? {},
      (state, messages: Parameters<typeof useLlm_call>[1], callOptions) =>
        useLlm_call(state, messages, callOptions, config),
    );
}
