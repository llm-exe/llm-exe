import { LlmExeError } from "@/errors";
import {
  IChatMessageContentDetailed,
  IChatMessageContentImageUrl,
} from "@/interfaces";

export type ParsedImageUrl =
  | { kind: "base64"; mediaType: string; data: string }
  | { kind: "url"; url: string };

export interface ImageContentErrorContext {
  operation: string;
  provider: string;
}

/**
 * Detects image content blocks by the presence of `image_url.url` rather than
 * an exact `type` match — the previous loose typing (`type: string`) allowed
 * shapes like `{ type: "image", image_url: {...} }` through, so detection by
 * key is what keeps those working.
 */
export function isImageUrlContentBlock(
  block: unknown,
): block is IChatMessageContentImageUrl {
  if (typeof block !== "object" || block === null) {
    return false;
  }
  const imageUrl = (block as Record<string, any>).image_url;
  return (
    typeof imageUrl === "object" &&
    imageUrl !== null &&
    typeof imageUrl.url === "string"
  );
}

/**
 * Distinguishes a content-block array from an arbitrary JSON array.
 *
 * Tool results have always accepted arbitrary JSON — an array of plain objects
 * is a deliberate, tested path (`maybeStringifyJSON` for Anthropic, a verbatim
 * Struct value for Gemini). Widening `IChatFunctionMessage.content` to allow
 * content blocks must not capture those arrays too, or a working call turns
 * into a provider 400 (Anthropic) or a thrown error (Gemini).
 *
 * `IChatMessageContentDetailed` requires `type: string`, so requiring every
 * entry to carry one matches the declared type exactly. Empty arrays keep the
 * arbitrary-JSON path, which is what they did before content blocks existed.
 */
export function isContentBlockArray(
  content: unknown,
): content is IChatMessageContentDetailed[] {
  return (
    Array.isArray(content) &&
    content.length > 0 &&
    content.every(
      (block) =>
        typeof block === "object" &&
        block !== null &&
        typeof (block as Record<string, any>).type === "string",
    )
  );
}

const DATA_URI_PATTERN = /^data:([^;,]+);base64,(.+)$/;

export function parseImageUrl(
  url: string,
  context: ImageContentErrorContext,
): ParsedImageUrl {
  if (typeof url !== "string" || url.trim() === "") {
    throw new LlmExeError("Image content block has an empty url", {
      code: "prompt.invalid_messages",
      context: {
        ...context,
        received: url,
        expected: "an https URL or a data: URI",
        resolution:
          "Set image_url.url to an https URL or a base64 data: URI (data:image/png;base64,...).",
      },
    });
  }

  if (url.startsWith("data:")) {
    const match = url.match(DATA_URI_PATTERN);
    if (!match) {
      throw new LlmExeError("Malformed data: URI in image content block", {
        code: "prompt.invalid_messages",
        context: {
          ...context,
          received: `${url.slice(0, 48)}...`,
          expected: "data:<media-type>;base64,<data>",
          resolution:
            "Images must be base64-encoded with an explicit media type, e.g. data:image/png;base64,iVBOR...",
        },
      });
    }
    return { kind: "base64", mediaType: match[1], data: match[2] };
  }

  return { kind: "url", url };
}
