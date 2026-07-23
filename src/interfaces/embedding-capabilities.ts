/**
 * Provider-agnostic description of what an embedding provider config can do.
 * This is metadata a consumer can query BEFORE building a request - batch
 * limits to fan out on, whether images are supported at all, and (critically)
 * the fusion semantics of a multimodal result - rather than hard-coding a
 * provider string and finding out the hard way.
 */

/** A modality an embedding provider can accept as input. */
export type EmbeddingModality = "text" | "image";

/** How a provider wants image bytes on the wire. */
export type EmbeddingImageForm =
  | "dataUri" // "data:image/png;base64,AAA"
  | "base64" // bare base64, no prefix
  | "url"; // https URL only

/**
 * What one request produces relative to what went in. A COMPATIBILITY GATE:
 * nothing in this package branches on it internally, but a consumer writing
 * to a single dimension-locked index must refuse anything but "fused" rather
 * than silently indexing an average or half a result.
 *   fused       - text+image jointly encoded into one vector
 *   averaged    - one vector, but the arithmetic mean of independent vectors
 *   perModality - separate text and image vectors returned
 */
export type EmbeddingFusion = "fused" | "averaged" | "perModality";

/** How a provider's `dimensions`/output-size option is constrained. */
export type EmbeddingDimensionRule =
  | { mode: "fixed"; value: number }
  | { mode: "enum"; values: readonly number[] }
  | { mode: "range"; min: number; max: number };

export interface EmbeddingCapabilities {
  modalities: readonly EmbeddingModality[];
  /** Items per HTTP request. 1 means the caller must fan out. */
  maxItemsPerRequest: number;
  /** Byte budget for the serialized request body. */
  maxRequestBytes: number;
  dimensions: EmbeddingDimensionRule;
  /** Present if and only if `modalities` includes "image". */
  multimodal?: {
    fusion: EmbeddingFusion;
    imageForm: EmbeddingImageForm;
    imageMimeTypes: readonly string[];
    maxImageBytes: number;
    /** Images allowed inside ONE item. */
    maxImagesPerItem: number;
  };
}
