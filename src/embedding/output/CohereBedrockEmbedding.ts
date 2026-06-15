import { CohereBedrockEmbeddingApiResponseOutput } from "@/types";
import { BaseEmbeddingOutput } from "@/embedding/output/BaseEmbeddingOutput";
import { deepClone } from "@/utils/modules/deepClone";
import { getBedrockTokenCounts } from "@/llm/output/_utils/getBedrockTokenCounts";

function resolveEmbeddings(
  embeddings: CohereBedrockEmbeddingApiResponseOutput["embeddings"],
  model: string
): number[][] {
  // Embed v3: embeddings is the array itself (response_type "embeddings_floats")
  if (Array.isArray(embeddings)) {
    return embeddings;
  }

  // Embed v4: embeddings is keyed by embedding type (response_type
  // "embeddings_by_type"). llm-exe never sends `embedding_types`, so the only
  // type Bedrock can return is float. Anything else is a response we did not
  // request — throw rather than guess.
  // if demanded, we can add a *.v2 provider shape and support this
  if (embeddings && typeof embeddings === "object") {
    if (Array.isArray(embeddings.float)) {
      return embeddings.float;
    }
    throw new Error(
      `Unexpected embeddings in Cohere Bedrock response (model: "${model}"). ` +
        `Expected float embeddings, received object with keys: ` +
        `[${Object.keys(embeddings).join(", ")}]`
    );
  }

  throw new Error(
    `Unexpected embeddings shape in Cohere Bedrock response (model: "${model}"). ` +
      `Expected an array (Embed v3) or an object with float embeddings (Embed v4), ` +
      `received: ${embeddings === null ? "null" : typeof embeddings}`
  );
}

export function CohereBedrockEmbedding(
  result: CohereBedrockEmbeddingApiResponseOutput,
  config: { model?: string },
  headers?: Record<string, string>
) {
  // Cohere on Bedrock returns token counts only in response headers, not the
  // body (verified against embed-v4, 2026-06: no billed_units).
  const headerUsage = getBedrockTokenCounts(headers);

  const __result = deepClone(result);
  const model = config.model || "cohere.unknown";
  const created = new Date().getTime();
  const embedding = resolveEmbeddings(__result.embeddings, model);

  const input_tokens = headerUsage?.input_tokens ?? 0;
  const output_tokens = headerUsage?.output_tokens ?? 0;
  const usage = {
    output_tokens,
    input_tokens,
    total_tokens: input_tokens + output_tokens,
  };

  return BaseEmbeddingOutput({
    id: __result.id,
    model,
    created,
    usage,
    embedding,
  });
}
