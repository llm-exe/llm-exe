import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { deprecateShorthand } from "@/llm/_utils.deprecationWarning";
import { Config } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { anthropicPromptSanitize } from "./promptSanitize";
import { OutputAnthropicClaude3Chat } from "@/llm/output/claude";
import { cleanJsonSchemaFor } from "@/llm/output/_utils/cleanJsonSchemaFor";

const ANTHROPIC_VERSION = "2023-06-01";

// Models that 400 if temperature / top_p / top_k are set to non-default values.
const MODELS_REJECTING_SAMPLING_PARAMS = [
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-fable-5",
];

// Claude 4.x rejects requests that set both temperature and top_p; keep temperature.
const isClaude4x = (model: string) =>
  /^claude-(opus|sonnet|haiku)-4-/.test(model);

const dropIfModelRejectsSamplingParams = (
  v: any,
  body: Record<string, any>
) => (MODELS_REJECTING_SAMPLING_PARAMS.includes(body.model) ? undefined : v);

const topPTransform = (v: any, body: Record<string, any>) => {
  if (MODELS_REJECTING_SAMPLING_PARAMS.includes(body.model)) return undefined;
  if (isClaude4x(body.model) && body.temperature !== undefined) return undefined;
  return v;
};

const anthropicChatV1: Config = {
  key: "anthropic.chat.v1",
  provider: "anthropic.chat",
  endpoint: `https://api.anthropic.com/v1/messages`,
  headers: `{"x-api-key":"{{anthropicApiKey}}", "Content-Type": "application/json", "anthropic-version": "${ANTHROPIC_VERSION}" }`,
  method: "POST",
  options: {
    prompt: {},
    system: {},
    effort: {},
    maxTokens: {
      required: [true, "maxTokens required"],
      default: 4096,
    },
    // Every key mapped in mapBody must also be declared here:
    // stateFromOptions picks only declared option keys, so an undeclared
    // key never reaches mapBody (see issue #661).
    temperature: {},
    topP: {},
    topK: {},
    stopSequences: {},
    metadata: {},
    serviceTier: {},
    anthropicApiKey: {
      default: getEnvironmentVariable("ANTHROPIC_API_KEY"),
    },
  },
  mapBody: {
    model: {
      key: "model",
    },
    maxTokens: {
      key: "max_tokens",
    },
    system: {
      key: "system",
    },
    prompt: {
      key: "messages",
      transform: anthropicPromptSanitize,
    },
    temperature: {
      key: "temperature",
      transform: dropIfModelRejectsSamplingParams,
    },
    topP: {
      key: "top_p",
      transform: topPTransform,
    },
    topK: {
      key: "top_k",
      transform: dropIfModelRejectsSamplingParams,
    },
    stopSequences: {
      key: "stop_sequences",
    },
    // No `stream` mapping: the request pipeline has no SSE support, so
    // forwarding stream=true would return an unparseable response.
    metadata: {
      key: "metadata",
    },
    serviceTier: {
      key: "service_tier",
    },
    effort: {
      key: "output_config.effort",
      transform: (
        v: unknown,
        _s: Record<string, any>,
        _output: Record<string, any>
      ) => {
        if (
          typeof v !== "string" ||
          !["minimal", "low", "medium", "high"].includes(v)
        ) {
          return undefined;
        }

        const model: string = _s.model || "";

        const isAdaptive =
          model.startsWith("claude-opus-4-6") ||
          model.startsWith("claude-opus-4-7") ||
          model.startsWith("claude-opus-4-8") ||
          model.startsWith("claude-sonnet-4-6") ||
          model.startsWith("claude-sonnet-5") ||
          model.startsWith("claude-fable-5");

        if (isAdaptive) {
          _output.thinking = { type: "adaptive" };
          const map: Record<string, string> = {
            minimal: "low",
            low: "low",
            medium: "medium",
            // Opus coding flagships take Anthropic's escalated "xhigh" for high
            // effort (per the Opus 4.7 coding/agentic recommendation); other
            // adaptive models use "high".
            high:
              model.startsWith("claude-opus-4-7") ||
              model.startsWith("claude-opus-4-8")
                ? "xhigh"
                : "high",
          };
          return map[v];
        }

        const isLegacy =
          model.startsWith("claude-opus-4-5") ||
          model.startsWith("claude-sonnet-4-5") ||
          model.startsWith("claude-haiku-4-5");

        if (isLegacy) {
          const budgetMap: Record<string, number> = {
            minimal: 1024,
            low: 4096,
            medium: 10240,
            high: 32768,
          };
          const budget = budgetMap[v];
          _output.thinking = { type: "enabled", budget_tokens: budget };
          // Anthropic requires max_tokens > budget_tokens (thinking tokens count
          // toward max_tokens). The default max_tokens (4096) is <= the low/medium/
          // high budgets, which 400s. Raise max_tokens to fit the budget plus an
          // output allowance, but never lower a caller's already-larger value.
          const OUTPUT_ALLOWANCE = 4096;
          const currentMax =
            typeof _output.max_tokens === "number" ? _output.max_tokens : 0;
          if (currentMax <= budget) {
            _output.max_tokens = budget + OUTPUT_ALLOWANCE;
          }
          return undefined;
        }

        return undefined;
      },
    },
  },
  mapOptions: {
    functionCall: (call, _options) => {
      // Anthropic handles "none" by clearing functions array
      if (call === "none") return { _clearFunctions: true };
      if (call === "auto" || call === "any") {
        return { tool_choice: { type: call } };
      }
      return { tool_choice: call };
    },

    functions: (functions) => ({
      tools: functions.map((f) => ({
        name: f.name,
        description: f.description,
        input_schema: cleanJsonSchemaFor(f.parameters, "anthropic.chat"),
      })),
    }),
  },
  transformResponse: OutputAnthropicClaude3Chat,
};

export const anthropic = {
  "anthropic.chat.v1": anthropicChatV1,
  // Claude Fable 5 models
  "anthropic.claude-fable-5": withDefaultModel(
    anthropicChatV1,
    "claude-fable-5"
  ),

  // Claude 4.8 models
  "anthropic.claude-opus-4-8": withDefaultModel(
    anthropicChatV1,
    "claude-opus-4-8"
  ),

  // Claude Sonnet 5 models
  "anthropic.claude-sonnet-5": withDefaultModel(
    anthropicChatV1,
    "claude-sonnet-5"
  ),

  // Claude 4.7 models
  "anthropic.claude-opus-4-7": withDefaultModel(
    anthropicChatV1,
    "claude-opus-4-7"
  ),

  // Claude 4.6 models
  "anthropic.claude-sonnet-4-6": withDefaultModel(
    anthropicChatV1,
    "claude-sonnet-4-6"
  ),

  // Claude 4.5 models
  "anthropic.claude-opus-4-5": withDefaultModel(
    anthropicChatV1,
    "claude-opus-4-5"
  ),
  "anthropic.claude-haiku-4-5": withDefaultModel(
    anthropicChatV1,
    "claude-haiku-4-5"
  ),
  "anthropic.claude-sonnet-4-5": withDefaultModel(
    anthropicChatV1,
    "claude-sonnet-4-5"
  ),

  // Deprecated
  ...deprecateShorthand("anthropic.claude-opus-4-6", {
    config: withDefaultModel(anthropicChatV1, "claude-opus-4-6"),
    message:
      'Shorthand "anthropic.claude-opus-4-6" is deprecated and may be removed in a future release.',
  }),
  // NOTE: "anthropic.claude-opus-4-1" (claude-opus-4-1-20250805) was removed —
  // Anthropic retires that model on Aug 5, 2026. Migrate to
  // anthropic.claude-opus-4-5/-6/-7/-8.
  // NOTE: "anthropic.claude-sonnet-4" (claude-sonnet-4-0) and
  // "anthropic.claude-opus-4" (claude-opus-4-0) were removed — Anthropic has
  // retired both models. Both the base aliases and the dated snapshots
  // (claude-opus-4-20250514 / claude-sonnet-4-20250514) now return HTTP 404,
  // so these shorthands could only ever error. Migrate to
  // anthropic.claude-opus-4-5/-6/-7/-8 or anthropic.claude-sonnet-4-5/-4-6/-5.
  ...deprecateShorthand("anthropic.claude-3-7-sonnet", {
    config: withDefaultModel(anthropicChatV1, "claude-3-7-sonnet-20250219"),
    message:
      'Shorthand "anthropic.claude-3-7-sonnet" is deprecated and may be removed in a future release.',
  }),
  ...deprecateShorthand("anthropic.claude-3-5-sonnet", {
    config: withDefaultModel(anthropicChatV1, "claude-3-5-sonnet-latest"),
    message:
      'Shorthand "anthropic.claude-3-5-sonnet" is deprecated and may be removed in a future release.',
  }),
  ...deprecateShorthand("anthropic.claude-3-5-haiku", {
    config: withDefaultModel(anthropicChatV1, "claude-3-5-haiku-latest"),
    message:
      'Shorthand "anthropic.claude-3-5-haiku" is deprecated and may be removed in a future release.',
  }),
  ...deprecateShorthand("anthropic.claude-3-opus", {
    config: withDefaultModel(anthropicChatV1, "claude-3-opus-20240229"),
    message:
      'Shorthand "anthropic.claude-3-opus" is deprecated and may be removed in a future release.',
  }),
};
