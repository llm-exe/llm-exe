import { Config } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { openaiPromptSanitize } from "./promptSanitize";
import { OutputOpenAIChat } from "@/llm/output/openai";
import { cleanJsonSchemaFor } from "@/llm/output/_utils/cleanJsonSchemaFor";

export function createOpenAiCompatibleConfiguration<
  K extends Config["key"],
>(overrides: {
  key: string;
  provider: string;
  endpoint: string;
  apiKeyMapping: [string, string];
  isReasoningModel?: (model: string) => boolean;
  reasoningEfforts?: readonly string[];
  /**
   * Body key that `maxTokens` maps to when `isReasoningModel(model)` is true.
   * OpenAI's gpt-5 / o-series reject the legacy `max_tokens` with a 400 and
   * require `max_completion_tokens`. Other OpenAI-compatible providers still
   * accept `max_tokens` on their reasoning models, so this is opt-in; when
   * unset, `max_tokens` is used for every model.
   */
  reasoningMaxTokensKey?: string;
  /**
   * When set, `temperature` and `top_p` are dropped for reasoning models
   * unless the caller's `effort` is one of these values. OpenAI's gpt-5.x
   * reject any non-default sampling value whenever reasoning is active
   * (gpt-5.5+ even with `reasoning_effort` unset) and only accept them under
   * `reasoning_effort: "none"`. When unset, sampling params are forwarded
   * unchanged for every model.
   */
  reasoningSamplingAllowedEfforts?: readonly string[];
  mapOptions?: Config["mapOptions"];
  transformResponse?: any;
}) {
  const [apiKeyPropertyKey, apiKeyPropertyValue] = overrides.apiKeyMapping;
  const isReasoningModel = overrides.isReasoningModel ?? (() => false);
  const reasoningEfforts = overrides.reasoningEfforts ?? ["minimal", "low", "medium", "high"];
  const reasoningMaxTokensKey = overrides.reasoningMaxTokensKey;
  const reasoningSamplingAllowedEfforts =
    overrides.reasoningSamplingAllowedEfforts;

  const isReasoningRequest = (state: Record<string, any>): boolean =>
    typeof state.model === "string" && isReasoningModel(state.model);

  // Sampling params are read from the frozen state (not `_output`) because the
  // temperature / topP transforms run before the effort transform in template
  // order, and the effort transform itself drops values outside
  // `reasoningEfforts`, so an invalid effort never counts as "allowed" here.
  const samplingParamTransform = (v: unknown, state: Record<string, any>) => {
    if (!reasoningSamplingAllowedEfforts || !isReasoningRequest(state)) {
      return v;
    }
    const effort = state.effort;
    const effortAllowsSampling =
      typeof effort === "string" &&
      reasoningEfforts.includes(effort) &&
      reasoningSamplingAllowedEfforts.includes(effort);
    return effortAllowsSampling ? v : undefined;
  };

  const maxTokensTransform = (
    v: unknown,
    state: Record<string, any>,
    output: Record<string, any>
  ) => {
    if (
      typeof v === "undefined" ||
      !reasoningMaxTokensKey ||
      !isReasoningRequest(state)
    ) {
      return v;
    }
    output[reasoningMaxTokensKey] = v;
    return undefined;
  };

  const config: Config = {
    key: overrides.key as K,
    provider: overrides.provider as Config["provider"],
    endpoint: overrides.endpoint,
    options: {
      prompt: {},
      effort: {},
      temperature: {},
      topP: {},
      maxTokens: {},
      stopSequences: {},
      frequencyPenalty: {},
      logitBias: {},
      useJson: {},
      [apiKeyPropertyKey]: {
        default: getEnvironmentVariable(apiKeyPropertyValue),
      },
    },
    method: "POST",
    headers: `{"Authorization":"Bearer {{${apiKeyPropertyKey}}}", "Content-Type": "application/json" }`,
    mapBody: {
      prompt: {
        key: "messages",
        transform: openaiPromptSanitize,
      },
      model: {
        key: "model",
      },
      temperature: {
        key: "temperature",
        transform: samplingParamTransform,
      },
      topP: {
        key: "top_p",
        transform: samplingParamTransform,
      },
      maxTokens: {
        key: "max_tokens",
        transform: maxTokensTransform,
      },
      stopSequences: {
        key: "stop",
      },
      frequencyPenalty: {
        key: "frequency_penalty",
      },
      logitBias: {
        key: "logit_bias",
      },
      useJson: {
        key: "response_format.type",
        transform: (v) => (v ? "json_object" : "text"),
      },
      effort: {
        key: "reasoning_effort",
        transform: (v, _s) => {
          if (
            typeof _s.model === "string" &&
            isReasoningModel(_s.model) &&
            typeof v === "string" &&
            reasoningEfforts.includes(v)
          ) {
            return v;
          }
          return undefined;
        },
      },
    },
    mapOptions: {
      jsonSchema: (schema, options, currentInput) => ({
        response_format: {
          ...(currentInput?.response_format || {}),
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: !!options?.functionCallStrictInput,
            schema: cleanJsonSchemaFor(schema, "openai.chat"),
          },
        },
      }),

      functionCall: (call) => {
        if (call === "any") return { tool_choice: "required" };
        if (call === "none") return { tool_choice: "none" };
        if (call === "auto") return { tool_choice: "auto" };
        return { tool_choice: call }; // specific function
      },

      functions: (functions, options) => ({
        tools: functions.map((f) => ({
          type: "function",
          function: {
            name: f.name,
            description: f.description,
            parameters: cleanJsonSchemaFor(f.parameters, "openai.chat"),
            strict: !!options?.functionCallStrictInput,
          },
        })),
      }),
      ...overrides.mapOptions,
    },
    transformResponse: overrides.transformResponse ?? OutputOpenAIChat,
  };

  return config;
}
