import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { deprecateShorthand } from "@/llm/_utils.deprecationWarning";
import { Config } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { anthropicPromptSanitize } from "./promptSanitize";
import {
  effortTransform,
  dropIfModelRejectsSamplingParams,
  topPTransform,
} from "./effort";
import { anthropicFunctionCall, anthropicFunctions } from "./mapOptions";
import { OutputAnthropicClaude3Chat } from "@/llm/output/claude";

const ANTHROPIC_VERSION = "2023-06-01";

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
      transform: effortTransform,
    },
  },
  mapOptions: {
    functionCall: anthropicFunctionCall,
    functions: anthropicFunctions,
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

  // Claude Opus 5 models
  "anthropic.claude-opus-5": withDefaultModel(anthropicChatV1, "claude-opus-5"),

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
