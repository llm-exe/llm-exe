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
  transformResponse?: any;
}) {
  const [apiKeyPropertyKey, apiKeyPropertyValue] = overrides.apiKeyMapping;
  const isReasoningModel = overrides.isReasoningModel ?? (() => false);
  const reasoningEfforts = overrides.reasoningEfforts ?? ["minimal", "low", "medium", "high"];

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
      },
      topP: {
        key: "top_p",
      },
      maxTokens: {
        key: "max_tokens",
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
    },
    transformResponse: overrides.transformResponse ?? OutputOpenAIChat,
  };

  return config;
}
