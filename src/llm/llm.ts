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
 * Resolves to `never` when the keys are only known as `string`, so a config
 * typed as plain `Config` adds nothing to the accepted options.
 */
type ConfigDeclaredOptions<C extends Config<any>> =
  string extends keyof C["options"]
    ? never
    : { [K in keyof C["options"]]?: unknown };

export function useLlmConfiguration<
  T extends keyof typeof configs,
  C extends Config<any> = Config<any>,
>(config: C) {
  return <
    Options extends AllUseLlmOptions[T]["input"] | ConfigDeclaredOptions<C>,
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
