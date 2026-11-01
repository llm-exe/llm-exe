import { LlmExeError } from "@/errors";
import { EmbeddingContentItem } from "@/types";

/**
 * Identifying detail carried into `embedding.unsupported_input` so a caller
 * can tell which provider config rejected the payload.
 */
export interface EmbeddingInputAssertionContext {
  operation: string;
  provider: string;
  model?: string;
}

const MULTIMODAL_RESOLUTION =
  'Use the "amazon:cohere.embedding.v1" provider with a multimodal model ' +
  "(for example cohere.embed-v4:0) to embed images.";

/**
 * A multimodal entry is an object carrying an array `content` property.
 *
 * The check is deliberately narrow. OpenAI's embeddings endpoint accepts
 * pre-tokenized input as number[][], so "array of non-strings" is NOT a
 * usable signal for "this is an image".
 */
export function isEmbeddingContentItem(
  value: unknown,
): value is EmbeddingContentItem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Array.isArray((value as { content?: unknown }).content);
}

/**
 * True when the whole batch is multimodal. An empty array is a text batch:
 * there is nothing to route to the multimodal request field.
 */
export function isMultimodalEmbeddingInput(
  value: unknown,
): value is EmbeddingContentItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isEmbeddingContentItem)
  );
}

/**
 * True when a content item appears anywhere in the input, including inside an
 * otherwise-text batch. Used by text-only providers to reject early.
 */
export function containsEmbeddingContentItem(value: unknown): boolean {
  if (isEmbeddingContentItem(value)) {
    return true;
  }
  return Array.isArray(value) && value.some(isEmbeddingContentItem);
}

/**
 * Cohere's Bedrock body has two mutually exclusive input fields: `texts` for a
 * plain batch and `inputs` for a multimodal one. A half-and-half array cannot
 * be expressed, and silently splitting it would return fewer embeddings than
 * inputs, misaligning every downstream index. Fail loudly instead.
 */
export function assertUniformEmbeddingInput(
  value: unknown,
  ctx: EmbeddingInputAssertionContext,
): void {
  if (!Array.isArray(value)) {
    return;
  }
  const itemCount = value.filter(isEmbeddingContentItem).length;
  if (itemCount === 0 || itemCount === value.length) {
    return;
  }
  throw new LlmExeError(
    `Embedding input mixes multimodal content items with plain values ` +
      `(${itemCount} of ${value.length} entries are content items). ` +
      `Send either all strings or all content items in one call.`,
    {
      code: "embedding.unsupported_input",
      context: {
        operation: ctx.operation,
        provider: ctx.provider,
        model: ctx.model,
        inputKind: "mixed",
        resolution:
          "Split the batch so text and multimodal entries are embedded in separate calls.",
      },
    },
  );
}

/**
 * Guard for providers with no image support. Without this the content item is
 * serialized into a field the provider expects to be a string, producing an
 * opaque provider-side 400 instead of a diagnosable error.
 */
export function assertTextOnlyEmbeddingInput(
  value: unknown,
  ctx: EmbeddingInputAssertionContext,
): void {
  if (!containsEmbeddingContentItem(value)) {
    return;
  }
  throw new LlmExeError(
    `Provider "${ctx.provider}" does not accept multimodal embedding input. ` +
      MULTIMODAL_RESOLUTION,
    {
      code: "embedding.unsupported_input",
      context: {
        operation: ctx.operation,
        provider: ctx.provider,
        model: ctx.model,
        inputKind: "multimodal",
        resolution: MULTIMODAL_RESOLUTION,
      },
    },
  );
}
