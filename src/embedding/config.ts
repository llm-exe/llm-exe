import { Config, EmbeddingProviderKey } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { LlmExeError } from "@/errors";

export const embeddingConfigs: {
  [key in EmbeddingProviderKey]: Config<EmbeddingProviderKey>;
} = {
  "openai.embedding.v1": {
    key: "openai.embedding.v1",
    provider: "openai.embedding",
    // Templated host: `baseUrl` defaults to OpenAI. Override to point at any
    // OpenAI-compatible embeddings server (Baseten, vLLM, TEI, Together, etc.).
    endpoint: `{{baseUrl}}/embeddings`,
    method: "POST",
    headers: `{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json" }`,
    options: {
      input: {},
      dimensions: {
        default: 1536,
      },
      encodingFormat: {},
      openAiApiKey: {
        default: getEnvironmentVariable("OPENAI_API_KEY"),
      },
      baseUrl: {
        default: "https://api.openai.com/v1",
      },
    },
    mapBody: {
      input: {
        key: "input",
      },
      model: {
        key: "model",
      },
      dimensions: {
        key: "dimensions",
      },
      encodingFormat: {
        key: "encoding_format",
      },
    },
  },

  "amazon.embedding.v1": {
    key: "amazon.embedding.v1",
    provider: "amazon.embedding",
    endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
    method: "POST",
    headers: `{"Content-Type": "application/json" }`,
    options: {
      input: {},
      dimensions: {
        default: 512,
      },
      awsRegion: {
        default: getEnvironmentVariable("AWS_REGION"),
        required: [true, "aws region is required"],
      },
      awsSecretKey: {},
      awsAccessKey: {},
    },
    mapBody: {
      input: {
        key: "inputText",
      },
      dimensions: {
        key: "dimensions",
      },
    },
  },

  "amazon:cohere.embedding.v1": {
    key: "amazon:cohere.embedding.v1",
    provider: "amazon:cohere.embedding",
    endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
    method: "POST",
    headers: `{"Content-Type": "application/json" }`,
    options: {
      input: {},
      inputType: {
        default: "search_document",
      },
      truncate: {},
      dimensions: {},
      awsRegion: {
        default: getEnvironmentVariable("AWS_REGION"),
        required: [true, "aws region is required"],
      },
      awsSecretKey: {},
      awsAccessKey: {},
    },
    mapBody: {
      input: {
        key: "texts",
        transform: (value: string | string[]) =>
          Array.isArray(value) ? value : [value],
      },
      inputType: {
        key: "input_type",
      },
      truncate: {
        key: "truncate",
      },
      dimensions: {
        key: "output_dimension",
        // Embed v3 has a fixed 1024-dim output and rejects the output_dimension
        // field entirely — even when the value matches. Drop the field for v3
        // when the user asked for the natural 1024; throw for any other value
        // so we don't silently mutate user intent.
        transform: (value: number | undefined, state: Record<string, any>) => {
          if (typeof value === "undefined") return undefined;
          const model: string = state?.model || "";
          const isV3 = /embed-(english|multilingual)-v3/.test(model);
          if (isV3) {
            if (value === 1024) return undefined;
            throw new LlmExeError(
              `Cohere Embed v3 only supports 1024-dimensional output (model: "${model}", requested: ${value}). Use cohere.embed-v4:0 for configurable dimensions.`,
              {
                code: "embedding.unsupported_dimensions",
                context: {
                  operation: "embedding.dimensionTransform",
                  provider: "amazon:cohere.embedding",
                  model,
                  dimensions: value,
                  expected: 1024,
                  resolution:
                    "Use cohere.embed-v4:0 for configurable dimensions.",
                },
              }
            );
          }
          return value;
        },
      },
    },
  },
};

export function getEmbeddingConfig(provider: EmbeddingProviderKey) {
  if (!provider) {
    throw new LlmExeError(`Missing provider`, {
      code: "embedding.missing_provider",
      context: {
        operation: "getEmbeddingConfig",
        availableProviders: Object.keys(embeddingConfigs),
        resolution: "Provide a valid embedding provider key.",
      },
    });
  }
  const pick = embeddingConfigs[provider];
  if (pick) {
    return pick;
  }
  throw new LlmExeError(`Invalid provider: ${provider}`, {
    code: "embedding.invalid_provider",
    context: {
      operation: "getEmbeddingConfig",
      provider,
      availableProviders: Object.keys(embeddingConfigs),
      resolution: "Provide a valid embedding provider key.",
    },
  });
}
