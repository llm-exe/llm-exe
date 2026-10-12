import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { deprecateShorthand } from "@/llm/_utils.deprecationWarning";
import { Config } from "@/types";
import { createOpenAiCompatibleConfiguration } from "../openai/compatible";

const deepseekChatV1: Config = createOpenAiCompatibleConfiguration({
  key: "deepseek.chat.v1",
  provider: "deepseek.chat",
  endpoint: `https://api.deepseek.com/v1/chat/completions`,
  apiKeyMapping: ["deepseekApiKey", "DEEPSEEK_API_KEY"],
  isReasoningModel: (model) => /^deepseek-(flash|v4)/.test(model),
  reasoningEfforts: ["low", "high", "max"],
  mapOptions: {
    // Chat completions supports JSON mode, but not server-enforced JSON Schema.
    // The executor still passes the response through the schema-validating parser.
    jsonSchema: () => ({ response_format: { type: "json_object" } }),
  },
});

export const deepseek = {
  "deepseek.chat.v1": deepseekChatV1,
  "deepseek.v4-flash": withDefaultModel(deepseekChatV1, "deepseek-v4-flash"),
  "deepseek.v4-pro": withDefaultModel(deepseekChatV1, "deepseek-v4-pro"),
  // Deprecated
  // DeepSeek announced deepseek-chat would stop working on 2026-07-24 and
  // dropped it from their docs, but it is still served: verified live on
  // 2026-10-12 it returns 200 with response model "deepseek-flash". It is not
  // interchangeable with deepseek-v4-flash, though, despite the shared model
  // name: deepseek-chat answers in non-thinking mode, while deepseek-v4-flash
  // defaults to thinking mode, spends reasoning tokens, and returns empty
  // content when maxTokens is too small to finish reasoning. That is why the
  // shorthand keeps its original model id and warns instead of being repointed,
  // matching every other deprecated shorthand in the repo.
  ...deprecateShorthand("deepseek.chat", {
    config: withDefaultModel(deepseekChatV1, "deepseek-chat"),
    message:
      'Model "deepseek.chat" is deprecated: DeepSeek has dropped deepseek-chat from its docs. Migrate to "deepseek.v4-flash", but note it runs in thinking mode by default, so it spends reasoning tokens and needs a larger maxTokens than deepseek.chat did.',
  }),
};
