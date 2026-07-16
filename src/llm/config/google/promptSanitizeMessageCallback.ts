import { IChatMessage } from "@/types";
import { LlmExeError } from "@/errors";
import { maybeParseJSON } from "@/utils";
import {
  isImageUrlContentBlock,
  parseImageUrl,
} from "../_utils/imageContent";

/**
 * Gemini cannot fetch arbitrary remote URLs — fileData.fileUri only accepts
 * Files API uploads (generativelanguage.googleapis.com) or gs:// objects.
 */
const GOOGLE_SUPPORTED_FILE_URI =
  /^(gs:\/\/|https:\/\/generativelanguage\.googleapis\.com\/)/;

function googleGeminiContentBlockToPart(block: any) {
  if (isImageUrlContentBlock(block)) {
    const parsed = parseImageUrl(block.image_url.url, {
      operation: "googleGeminiPromptMessageCallback",
      provider: "google.chat",
    });
    if (parsed.kind === "base64") {
      return {
        inlineData: { mimeType: parsed.mediaType, data: parsed.data },
      };
    }
    if (GOOGLE_SUPPORTED_FILE_URI.test(parsed.url)) {
      return { fileData: { fileUri: parsed.url } };
    }
    throw new LlmExeError("Gemini cannot load images from arbitrary URLs", {
      code: "prompt.invalid_messages",
      context: {
        operation: "googleGeminiPromptMessageCallback",
        provider: "google.chat",
        received: parsed.url,
        expected: "a base64 data: URI, a Files API URI, or a gs:// URI",
        resolution:
          "Pass the image as a data: URI (data:image/png;base64,...), or upload it with the Gemini Files API and pass the returned file URI.",
      },
    });
  }
  if (typeof block?.text === "string") {
    return { text: block.text };
  }
  // unrecognized block — assume it is already a Gemini-native part
  return block;
}

export function googleGeminiPromptMessageCallback(_message: IChatMessage) {
  /// TODO: Type this properly, its a Gemini message
  let message: Record<string, any> = { ..._message };

  const parts = [];

  if (message.role === "assistant") {
    message.role = "model";
  }

  // this should not happen, its guarded before this
  // if any get through, maybe we let later ones through?
  // should figure this out.
  // TODO: something
  if (message.role === "system") {
    message.role = "model";
  }

  // do gemini-specific transformations
  let { role, ...payload } = message;

  if (typeof payload.content === "string" && message.role !== "function") {
    parts.push({ text: message.content });
  }

  if (Array.isArray(payload.content) && message.role !== "function") {
    parts.push(...payload.content.map(googleGeminiContentBlockToPart));
  }

  if (message.role === "function") {
    role = "user";
    parts.push({
      functionResponse: {
        name: message.name,
        response: {
          result: message.content,
        },
      },
    });

    delete message.id;
  }

  if (message?.function_call) {
    const { function_call } = message;
    const toolsArr = Array.isArray(function_call)
      ? function_call
      : [function_call];
    role = "model";

    parts.push(
      ...toolsArr.map((call: any) => {
        const { name, arguments: input } = call;
        return {
          functionCall: {
            name,
            args: maybeParseJSON(input),
          },
        };
      })
    );

    delete message.function_call;
  }

  return {
    role,
    parts,
  };
}
