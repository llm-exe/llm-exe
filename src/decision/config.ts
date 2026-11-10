import type { Config, DecisionModelKey } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { LlmExeError } from "@/errors";

function openAiDecisionsConfig(
  key: DecisionModelKey,
  defaultModel?: string,
): Config<DecisionModelKey> {
  return {
    key,
    provider: "openai.decisions",
    // Templated host so an OpenAI-compatible decisions server can be used.
    endpoint: `{{baseUrl}}/decisions`,
    method: "POST",
    headers: `{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json" }`,
    options: {
      model: defaultModel
        ? { default: defaultModel }
        : { required: [true, "model is required for openai.decisions.v1"] },
      openAiApiKey: {
        default: getEnvironmentVariable("OPENAI_API_KEY"),
      },
      baseUrl: {
        default: "https://api.openai.com/v1",
      },
    },
    // The request body is built from the question map in decision.call.ts,
    // not from options, so there is nothing to map here.
    mapBody: {},
  };
}

export const decisionConfigs: {
  [key in DecisionModelKey]: Config<DecisionModelKey>;
} = {
  "openai.decisions.v1": openAiDecisionsConfig("openai.decisions.v1"),
  "openai.gpt-6-luna": openAiDecisionsConfig("openai.gpt-6-luna", "gpt-6-luna"),
};

function isDecisionModelKey(key: unknown): key is DecisionModelKey {
  return (
    typeof key === "string" &&
    Object.prototype.hasOwnProperty.call(decisionConfigs, key)
  );
}

export function getDecisionConfig(key: unknown): Config<DecisionModelKey> {
  if (isDecisionModelKey(key)) {
    return decisionConfigs[key];
  }
  throw new LlmExeError(`Invalid decision model: ${String(key)}`, {
    code: "configuration.invalid_provider",
    context: {
      operation: "useDecisionModel",
      provider: typeof key === "string" ? key : undefined,
      availableProviders: Object.keys(decisionConfigs),
      resolution: "Use one of the available decision model keys.",
    },
  });
}
