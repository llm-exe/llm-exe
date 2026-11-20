import type { Config, DecisionModelKey } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { LlmExeError } from "@/errors";

type ModelOption = Config["options"][string];

function modelOption(
  key: DecisionModelKey,
  defaultModel?: string,
): ModelOption {
  return defaultModel
    ? { default: defaultModel }
    : { required: [true, `model is required for ${key}`] };
}

function openAiDecisions(
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
      model: modelOption(key, defaultModel),
      openAiApiKey: { default: getEnvironmentVariable("OPENAI_API_KEY") },
      baseUrl: { default: "https://api.openai.com/v1" },
    },
    // The request body is built from the question map by the adapter, not
    // from options, so there is nothing to map here.
    mapBody: {},
  };
}

function typeSafeSystemOne(
  key: DecisionModelKey,
  defaultModel?: string,
): Config<DecisionModelKey> {
  return {
    key,
    provider: "typesafe.systemone",
    // Templated host so a self-hosted System One server can be used.
    endpoint: `{{baseUrl}}/systemone`,
    method: "POST",
    headers: `{"Authorization":"Bearer {{typesafeApiKey}}", "Content-Type": "application/json" }`,
    options: {
      model: modelOption(key, defaultModel),
      typesafeApiKey: { default: getEnvironmentVariable("TYPESAFE_API_KEY") },
      baseUrl: { default: "https://api.typesafe.ai/v1" },
    },
    mapBody: {},
  };
}

function cloudflareClef(
  key: DecisionModelKey,
  model: "clef" | "clef-flash",
): Config<DecisionModelKey> {
  return {
    key,
    provider: "cloudflare.clef",
    // Workers AI picks the model from the path, and Clef's `model` body field
    // must name the same one ("clef" for @cf/cloudflare/clef, "clef-flash" for
    // @cf/cloudflare/clef-flash), so both come from the same option.
    // https://developers.cloudflare.com/workers-ai/models/clef/
    endpoint: `https://api.cloudflare.com/client/v4/accounts/{{cloudflareAccountId}}/ai/run/@cf/cloudflare/{{model}}`,
    method: "POST",
    headers: `{"Authorization":"Bearer {{cloudflareApiToken}}", "Content-Type": "application/json" }`,
    options: {
      model: { default: model },
      cloudflareApiToken: {
        default: getEnvironmentVariable("CLOUDFLARE_API_TOKEN"),
      },
      cloudflareAccountId: {
        default: getEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID"),
        required: [
          true,
          "cloudflareAccountId is required (or set CLOUDFLARE_ACCOUNT_ID)",
        ],
      },
    },
    mapBody: {},
  };
}

export const decisionConfigs: {
  [key in DecisionModelKey]: Config<DecisionModelKey>;
} = {
  "openai.decisions.v1": openAiDecisions("openai.decisions.v1"),
  "openai.gpt-6-luna": openAiDecisions("openai.gpt-6-luna", "gpt-6-luna"),
  "typesafe.systemone.v1": typeSafeSystemOne("typesafe.systemone.v1"),
  "typesafe.jev": typeSafeSystemOne("typesafe.jev", "jev-latest"),
  "cloudflare.clef": cloudflareClef("cloudflare.clef", "clef"),
  "cloudflare.clef-flash": cloudflareClef(
    "cloudflare.clef-flash",
    "clef-flash",
  ),
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
