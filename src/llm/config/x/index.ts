import { deprecateShorthand } from "@/llm/_utils.deprecationWarning";
import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { Config } from "@/types";
import { createOpenAiCompatibleConfiguration } from "../openai/compatible";

// Explicit list rather than a suffix match — "grok-4.20-0309-non-reasoning"
// also ends in "-reasoning", so `endsWith` would wrongly enable effort for it.
const XAI_REASONING_MODELS = [
  "grok-4.3",
  "grok-4.5",
  "grok-4.6",
  "grok-4.20-0309-reasoning",
];

const xaiChatV1: Config = createOpenAiCompatibleConfiguration({
  key: "xai.chat.v1",
  provider: "xai.chat",
  endpoint: `https://api.x.ai/v1/chat/completions`,
  apiKeyMapping: ["xAiApiKey", "XAI_API_KEY"],
  isReasoningModel: (model) => XAI_REASONING_MODELS.includes(model),
});

export const xai = {
  "xai.chat.v1": xaiChatV1,
  "xai.grok-4.3": withDefaultModel(xaiChatV1, "grok-4.3"),
  "xai.grok-4.20": withDefaultModel(xaiChatV1, "grok-4.20-0309-non-reasoning"),
  "xai.grok-4.20-reasoning": withDefaultModel(
    xaiChatV1,
    "grok-4.20-0309-reasoning"
  ),
  "xai.grok-4.5": withDefaultModel(xaiChatV1, "grok-4.5"),
  "xai.grok-4.6": withDefaultModel(xaiChatV1, "grok-4.6"),

  // Deprecated — retired by xAI on 2026-05-15. The slugs still resolve, but
  // xAI redirects them to grok-4.3 (non-reasoning models with "none" effort).
  ...deprecateShorthand("xai.grok-3", {
    config: withDefaultModel(xaiChatV1, "grok-3"),
    message:
      'Model "xai.grok-3" was retired by xAI on 2026-05-15 and now redirects to grok-4.3. Migrate to "xai.grok-4.3".',
  }),
  ...deprecateShorthand("xai.grok-4-fast", {
    config: withDefaultModel(xaiChatV1, "grok-4-fast-non-reasoning"),
    message:
      'Model "xai.grok-4-fast" was retired by xAI on 2026-05-15 and now redirects to grok-4.3. Migrate to "xai.grok-4.3".',
  }),
  ...deprecateShorthand("xai.grok-4-1-fast", {
    config: withDefaultModel(xaiChatV1, "grok-4-1-fast-non-reasoning"),
    message:
      'Model "xai.grok-4-1-fast" was retired by xAI on 2026-05-15 and now redirects to grok-4.3. Migrate to "xai.grok-4.3".',
  }),

  // Delisted by xAI — no longer in their models docs and no published
  // redirect. Kept only so existing code warns instead of failing silently.
  // Slated for removal in the next major release.
  ...deprecateShorthand("xai.grok-2", {
    config: withDefaultModel(xaiChatV1, "grok-2-latest"),
    message:
      'Model "xai.grok-2" is no longer served by xAI and will fail at the API. Migrate to "xai.grok-4.3".',
  }),
  ...deprecateShorthand("xai.grok-3-mini", {
    config: withDefaultModel(xaiChatV1, "grok-3-mini"),
    message:
      'Model "xai.grok-3-mini" is deprecated — xAI no longer lists it as a current model. Migrate to "xai.grok-4.3".',
  }),
  ...deprecateShorthand("xai.grok-4", {
    config: withDefaultModel(xaiChatV1, "grok-4"),
    message:
      'Model "xai.grok-4" is deprecated — xAI no longer lists it as a current model. Migrate to "xai.grok-4.3".',
  }),
};
