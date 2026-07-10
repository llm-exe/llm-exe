import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { Config } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { OutputOllamaChat } from "@/llm/output/ollama";
import { ollamaPromptSanitize } from "./promptSanitize";
const ollamaChatV1: Config = {
  key: "ollama.chat.v1",
  provider: "ollama.chat",
  endpoint: `${
    getEnvironmentVariable("OLLAMA_ENDPOINT") || `http://localhost:11434`
  }/api/chat`,
  options: {
    prompt: {},
    temperature: {},
    topP: {},
    maxTokens: {},
    stopSequences: {},
  },
  method: "POST",
  headers: `{"Content-Type": "application/json" }`,
  mapBody: {
    prompt: {
      key: "messages",
      transform: (v) => ollamaPromptSanitize(v),
    },
    model: {
      key: "model",
    },
    temperature: {
      key: "options.temperature",
    },
    topP: {
      key: "options.top_p",
    },
    maxTokens: {
      key: "options.num_predict",
    },
    stopSequences: {
      key: "options.stop",
    },
  },
  transformResponse: OutputOllamaChat,
};

export const ollama = {
  "ollama.chat.v1": ollamaChatV1,
  "ollama.deepseek-r1": withDefaultModel(ollamaChatV1, "deepseek-r1"),
  "ollama.llama3.3": withDefaultModel(ollamaChatV1, "llama3.3"),
  "ollama.llama3.2": withDefaultModel(ollamaChatV1, "llama3.2"),
  "ollama.llama3.1": withDefaultModel(ollamaChatV1, "llama3.1"),
  "ollama.qwq": withDefaultModel(ollamaChatV1, "qwq"),
  "ollama.gemma3": withDefaultModel(ollamaChatV1, "gemma3"),
  "ollama.mistral": withDefaultModel(ollamaChatV1, "mistral"),
  "ollama.qwen2.5": withDefaultModel(ollamaChatV1, "qwen2.5"),
  "ollama.qwen3": withDefaultModel(ollamaChatV1, "qwen3"),
  "ollama.qwen3.5": withDefaultModel(ollamaChatV1, "qwen3.5"),
  "ollama.gemma4": withDefaultModel(ollamaChatV1, "gemma4"),
  "ollama.gpt-oss": withDefaultModel(ollamaChatV1, "gpt-oss"),
};
