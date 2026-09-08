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

export function useLlmConfiguration<T extends keyof typeof configs>(
  config: Config<any>,
) {
  return <Options extends AllUseLlmOptions[T]["input"]>(options?: Options) =>
    apiRequestWrapper(
      config,
      options ?? {},
      (state, messages: Parameters<typeof useLlm_call>[1], callOptions) =>
        useLlm_call(state, messages, callOptions, config),
    );
}
