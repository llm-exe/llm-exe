import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { Config } from "@/types";
import { createOpenAiCompatibleConfiguration } from "../openai/compatible";

const xaiChatV1: Config = createOpenAiCompatibleConfiguration({
  key: "xai.chat.v1",
  provider: "xai.chat",
  endpoint: `https://api.x.ai/v1/chat/completions`,
  apiKeyMapping: ["xAiApiKey", "XAI_API_KEY"],
  isReasoningModel: (model) => model === "grok-4.3",
});

export const xai = {
  "xai.chat.v1": xaiChatV1,
  "xai.grok-2": withDefaultModel(xaiChatV1, "grok-2-latest"),
  "xai.grok-3": withDefaultModel(xaiChatV1, "grok-3"),
  "xai.grok-3-mini": withDefaultModel(xaiChatV1, "grok-3-mini"),
  "xai.grok-4": withDefaultModel(xaiChatV1, "grok-4"),
  "xai.grok-4-fast": withDefaultModel(xaiChatV1, "grok-4-fast-non-reasoning"),
  "xai.grok-4-1-fast": withDefaultModel(xaiChatV1, "grok-4-1-fast-non-reasoning"),
  "xai.grok-4.3": withDefaultModel(xaiChatV1, "grok-4.3"),
  "xai.grok-4.20": withDefaultModel(xaiChatV1, "grok-4.20-0309-non-reasoning"),
  "xai.grok-4.20-reasoning": withDefaultModel(
    xaiChatV1,
    "grok-4.20-0309-reasoning"
  ),
};
