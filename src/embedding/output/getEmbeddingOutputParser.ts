import { AmazonTitanEmbedding } from "@/embedding/output/AmazonTitan";
import { CohereBedrockEmbedding } from "@/embedding/output/CohereBedrockEmbedding";
import { OpenAiEmbedding } from "@/embedding/output/OpenAiEmbedding";
import { embeddingConfigs } from "@/embedding/config";
import { EmbeddingProviderKey } from "@/types";
import { LlmExeError } from "@/errors";

export function getEmbeddingOutputParser(
  config: {
    model?: string;
    key: EmbeddingProviderKey;
  },
  response: any,
  headers?: Record<string, string>
) {
  switch (config.key) {
    case "openai.embedding.v1":
      return OpenAiEmbedding(response, config);
    case "amazon.embedding.v1":
      return AmazonTitanEmbedding(response, config);
    case "amazon:cohere.embedding.v1":
      return CohereBedrockEmbedding(response, config, headers);
    default:
      throw new LlmExeError("Unsupported provider", {
        code: "embedding.invalid_response_shape",
        context: {
          operation: "getEmbeddingOutputParser",
          provider: config.key,
          model: config.model,
          availableProviders: Object.keys(embeddingConfigs),
          resolution:
            "Use a supported embedding provider key.",
        },
      });
  }
}
