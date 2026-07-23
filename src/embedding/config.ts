import {
  Config,
  EmbeddingCapabilities,
  EmbeddingProviderKey,
} from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { LlmExeError } from "@/errors";
import {
  assertTextOnlyEmbeddingInput,
  assertUniformEmbeddingInput,
  isMultimodalEmbeddingInput,
} from "./embedding.input";
import { cohereInterleavedInputs } from "./content/cohere";

/**
 * Adding a new multimodal embedding provider under this design is mechanical:
 *
 * 1. Declare its `capabilities` (modalities, batch/byte limits, dimension
 *    rule, and - if it accepts images - the `multimodal` block including
 *    `fusion`). Use documented numbers; mark anything undocumented as
 *    conservative in a comment.
 * 2. Write a renderer: a named, exported pure function under
 *    `src/embedding/content/<provider>.ts` that shapes the provider's request
 *    body from the call input (see `cohereInterleavedInputs` for the shape).
 * 3. Wire the renderer into the config's `mapBody` transform(s) below.
 * 4. Add an output parser under `src/embedding/output/` and register it in
 *    `getEmbeddingOutputParser`.
 * 5. Add tests: capabilities shape, renderer behavior, and mapBody
 *    composition, mirroring the Cohere test blocks in `config.test.ts`.
 *
 * `EmbeddingCapabilities` is a compatibility gate, not a behavior switch:
 * nothing in this file branches on `fusion`. It exists so a consumer (for
 * example one writing into a dimension-locked vector index) can refuse a
 * provider whose multimodal result is "averaged" or "perModality" instead of
 * silently indexing a weaker or incomplete vector.
 */

export const embeddingConfigs: {
  [key in EmbeddingProviderKey]: Config<EmbeddingProviderKey> & {
    capabilities: EmbeddingCapabilities;
  };
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
        // OpenAI's embeddings endpoint accepts a string, a string[], or
        // pre-tokenized number[][]. It has no image field, so a content item
        // would be posted as an object where a string is expected and come
        // back as an opaque 400. Reject it here with the provider named.
        transform: (value: unknown, state: Record<string, any>) => {
          assertTextOnlyEmbeddingInput(value, {
            operation: "embedding.inputTransform",
            provider: "openai.embedding",
            model: state?.model,
          });
          return value;
        },
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
    capabilities: {
      modalities: ["text"],
      // core-stack's getEmbeddingInfo treats every non-Cohere embedding
      // provider (this one included) as a single-item, 1 MB-budget call.
      // Matching that here keeps behavior identical when core-stack switches
      // to reading limits from this registry.
      maxItemsPerRequest: 1,
      maxRequestBytes: 1024 * 1024,
      dimensions: {
        mode: "range",
        // OpenAI documents text-embedding-3-small's `dimensions` param as
        // "any value from 256 to 1536". text-embedding-3-large accepts the
        // same 256 floor and goes up to a native 3072, but this config's
        // `model` option has no default and both models share this one key,
        // so 1536 (the smaller model's native ceiling) is used as the
        // conservative max rather than overclaiming 3072 for every model.
        min: 256,
        max: 1536,
      },
      // No `multimodal` block: this endpoint has no image field.
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
        // Titan's inputText is a single string. It has a separate multimodal
        // model with a different request shape that this config does not
        // target, so image content is a hard error rather than a silent
        // object-in-a-string-field.
        transform: (value: unknown, state: Record<string, any>) => {
          assertTextOnlyEmbeddingInput(value, {
            operation: "embedding.inputTransform",
            provider: "amazon.embedding",
            model: state?.model,
          });
          return value;
        },
      },
      dimensions: {
        key: "dimensions",
      },
    },
    capabilities: {
      modalities: ["text"],
      // Titan's inputText schema has no array field: one text in, one vector
      // out. core-stack's getEmbeddingInfo already treats this as
      // maxBatchSize 1 / maxBatchBytes 1 MB for every non-Cohere provider;
      // mirrored here verbatim.
      maxItemsPerRequest: 1,
      maxRequestBytes: 1024 * 1024,
      dimensions: {
        mode: "enum",
        // Amazon Titan Text Embeddings V2 documents 1024 (its own default),
        // 512, and 256 as the supported output sizes. This config's default
        // of 512 is one of those three values, not the fixed-1536 V1
        // generation's single size.
        values: [256, 512, 1024],
      },
      // No `multimodal` block: Titan's multimodal model (amazon.titan-embed-image-v1)
      // has a different request shape this config does not target - image
      // content is a hard error here, not a silent object-in-a-string-field.
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
      // Declared so stateFromOptions' pick() does not drop a caller-supplied
      // value. Normally left unset: a multimodal call input is routed to
      // `inputs` by the transform below without any option being set.
      imageInputs: {},
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
        // `texts` and `inputs` are mutually exclusive in the Bedrock body.
        // Omit `texts` when EITHER the call input is multimodal OR the caller
        // set the `imageInputs` escape hatch — in both cases the batch is
        // carried by the `imageInputs` entry below instead. Checking only the
        // call input would let a plain-text call combined with an
        // `imageInputs` option produce a body with both fields, which Cohere
        // rejects. Returning the content items here instead of omitting them
        // would JSON-serialize base64 image payloads into a field Cohere
        // reads as plain text.
        transform: (value: unknown, state: Record<string, any>) => {
          assertUniformEmbeddingInput(value, {
            operation: "embedding.textsTransform",
            provider: "amazon:cohere.embedding",
            model: state?.model,
          });
          if (
            isMultimodalEmbeddingInput(value) ||
            isMultimodalEmbeddingInput(state?.imageInputs)
          ) {
            return undefined;
          }
          return Array.isArray(value) ? value : [value];
        },
      },
      imageInputs: {
        key: "inputs",
        // Cohere Embed v4's interleaved request field. A multimodal call
        // input always wins over an explicit `imageInputs` option (the option
        // is only an escape hatch for a text call input); either one alone is
        // enough to populate this field, which is what keeps it mutually
        // exclusive with `texts` above.
        transform: (value: unknown, state: Record<string, any>) => {
          return cohereInterleavedInputs(state?.input, value);
        },
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
    capabilities: {
      modalities: ["text", "image"],
      // Matches core-stack's getEmbeddingInfo maxBatchSize for Cohere on
      // Bedrock (96) - the one provider that branch treats differently from
      // every other embedding provider. Also matches Cohere's documented
      // "max 96 images per call".
      maxItemsPerRequest: 96,
      // Matches core-stack's getEmbeddingInfo maxBatchBytes for Cohere: 18 MB
      // leaves headroom under Bedrock's ~20 MB request cap for base64
      // expansion and JSON framing.
      maxRequestBytes: 18 * 1024 * 1024,
      dimensions: {
        mode: "enum",
        // Embed v4's output_dimension accepts these four Matryoshka sizes
        // (Cohere docs, default 1536). Embed v3 is fixed at 1024 and rejects
        // the field entirely - enforced by the dimensions transform above,
        // not by this descriptor.
        values: [256, 512, 1024, 1536],
      },
      multimodal: {
        // Embed v4 encodes the interleaved text+image content of one `inputs`
        // entry into a single vector (Cohere docs: multimodal embeddings).
        fusion: "fused",
        imageForm: "dataUri",
        // Cohere docs: image must be image/jpeg, image/png, image/webp, or
        // image/gif.
        imageMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        // Cohere docs: 5 MB max per image.
        maxImageBytes: 5 * 1024 * 1024,
        // Cohere docs: one `inputs.content[]` entry accepts text only, one
        // image only, or text combined with ONE image - never more than one
        // image per entry.
        maxImagesPerItem: 1,
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

/**
 * Consumer-facing capability lookup. Prefer this over reading
 * `embeddingConfigs[key].capabilities` directly or hard-coding a provider
 * string in a compatibility check.
 */
export function getEmbeddingCapabilities(
  key: EmbeddingProviderKey
): EmbeddingCapabilities {
  return getEmbeddingConfig(key).capabilities;
}
