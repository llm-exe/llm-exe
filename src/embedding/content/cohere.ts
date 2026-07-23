import { EmbeddingContentItem } from "@/types";
import { isMultimodalEmbeddingInput } from "@/embedding/embedding.input";

/**
 * Renders Cohere Embed v4's interleaved `inputs` request field (Bedrock body)
 * from a call's `input` and its `imageInputs` escape hatch.
 *
 * A multimodal call input always wins over an explicit `imageInputs` option
 * (the option is only an escape hatch for a text call input); either one
 * alone is enough to populate the field. Returns undefined when neither is
 * multimodal, which is what keeps this field mutually exclusive with `texts`
 * in the composed body (see the `texts` transform in `../config.ts`).
 */
export function cohereInterleavedInputs(
  input: unknown,
  imageInputsOption: unknown
): EmbeddingContentItem[] | undefined {
  if (isMultimodalEmbeddingInput(input)) return input;
  if (isMultimodalEmbeddingInput(imageInputsOption)) return imageInputsOption;
  return undefined;
}
