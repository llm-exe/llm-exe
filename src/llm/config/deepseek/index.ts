import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { Config } from "@/types";
import { createOpenAiCompatibleConfiguration } from "../openai/compatible";

const deepseekChatV1: Config = createOpenAiCompatibleConfiguration({
  key: "deepseek.chat.v1",
  provider: "deepseek.chat",
  endpoint: `https://api.deepseek.com/v1/chat/completions`,
  apiKeyMapping: ["deepseekApiKey", "DEEPSEEK_API_KEY"],
  isReasoningModel: (model) => model.startsWith("deepseek-v4"),
  reasoningEfforts: ["low", "high", "max"],
});

// Chat completions supports JSON mode, but not server-enforced JSON Schema.
// The executor still passes the response through the schema-validating parser.
deepseekChatV1.mapOptions = {
  ...deepseekChatV1.mapOptions,
  jsonSchema: () => ({ response_format: { type: "json_object" } }),
};

export const deepseek = {
  "deepseek.chat.v1": deepseekChatV1,
  "deepseek.chat": withDefaultModel(deepseekChatV1, "deepseek-chat"),
  "deepseek.v4-flash": withDefaultModel(deepseekChatV1, "deepseek-v4-flash"),
  "deepseek.v4-pro": withDefaultModel(deepseekChatV1, "deepseek-v4-pro"),
};
