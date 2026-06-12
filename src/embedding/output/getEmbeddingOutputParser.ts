import { AmazonTitanEmbedding } from "@/embedding/output/AmazonTitan";
import { CohereBedrockEmbedding } from "@/embedding/output/CohereBedrockEmbedding";
import { OpenAiEmbedding } from "@/embedding/output/OpenAiEmbedding";
import { EmbeddingProviderKey } from "@/types";

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
      throw new Error("Unsupported provider");
  }
}
