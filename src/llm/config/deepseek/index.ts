import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { deprecateShorthand } from "@/llm/_utils.deprecationWarning";
import { Config } from "@/types";
import { createOpenAiCompatibleConfiguration } from "../openai/compatible";

const deepseekChatV1: Config = createOpenAiCompatibleConfiguration({
  key: "deepseek.chat.v1",
  provider: "deepseek.chat",
  endpoint: `https://api.deepseek.com/v1/chat/completions`,
  apiKeyMapping: ["deepseekApiKey", "DEEPSEEK_API_KEY"],
});

export const deepseek = {
  "deepseek.chat.v1": deepseekChatV1,
  "deepseek.v4-flash": withDefaultModel(deepseekChatV1, "deepseek-v4-flash"),
  "deepseek.v4-pro": withDefaultModel(deepseekChatV1, "deepseek-v4-pro"),
  // Deprecated
  // NOTE: DeepSeek retired the "deepseek-chat" model on 2026-07-24 and has
  // since removed it from their docs, so the shorthand's original model ID no
  // longer resolves. Their docs describe "deepseek-chat" as the non-thinking
  // mode of deepseek-v4-flash, so the default is repointed there to keep
  // existing callers working while the warning steers them to the new name.
  ...deprecateShorthand("deepseek.chat", {
    config: withDefaultModel(deepseekChatV1, "deepseek-v4-flash"),
    message:
      'Model "deepseek.chat" is deprecated — DeepSeek retired the underlying deepseek-chat model on 2026-07-24. Migrate to deepseek.v4-flash.',
  }),
};
