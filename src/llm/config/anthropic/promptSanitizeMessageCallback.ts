import { IChatMessage } from "@/interfaces";
import { LlmExeError } from "@/errors";
import { maybeParseJSON, maybeStringifyJSON } from "@/utils";
import {
  isImageUrlContentBlock,
  parseImageUrl,
} from "../_utils/imageContent";

export interface AnthropicPromptSanitizeOptions {
  provider?: string;
  /**
   * Anthropic's API accepts `source: { type: "url" }` image blocks; Bedrock's
   * invoke API does not, so the Bedrock config disables this and requires
   * base64 data: URIs.
   */
  allowImageUrlSources?: boolean;
}

export function anthropicPromptMessageCallback(
  _message: IChatMessage,
  options: AnthropicPromptSanitizeOptions = {}
) {
  const { provider = "anthropic.chat", allowImageUrlSources = true } = options;

  /// TODO: Type this properly, its an Anthropic message
  let message: Record<string, any> = { ..._message };

  if (Array.isArray(message.content)) {
    message.content = message.content.map((block: any) => {
      if (!isImageUrlContentBlock(block)) {
        return block;
      }
      const parsed = parseImageUrl(block.image_url.url, {
        operation: "anthropicPromptMessageCallback",
        provider,
      });
      if (parsed.kind === "base64") {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: parsed.mediaType,
            data: parsed.data,
          },
        };
      }
      if (!allowImageUrlSources) {
        throw new LlmExeError("Image URLs are not supported by this provider", {
          code: "prompt.invalid_messages",
          context: {
            operation: "anthropicPromptMessageCallback",
            provider,
            received: parsed.url,
            expected: "a base64 data: URI",
            resolution:
              "Bedrock does not fetch remote images. Base64-encode the image and pass it as a data: URI (data:image/png;base64,...).",
          },
        });
      }
      return {
        type: "image",
        source: { type: "url", url: parsed.url },
      };
    });
  }

  if (message.role === "function") {
    message.role = "user";
    // Array content has already been converted to Anthropic block shapes
    // above; pass it through as the tool_result content array so images stay
    // native. Only string/object content gets stringified.
    message.content = [
      {
        type: "tool_result",
        tool_use_id: message.id,
        content: Array.isArray(message.content)
          ? message.content
          : maybeStringifyJSON(message.content),
      },
    ];

    delete message.name;
    delete message.id;
  }

  if (message?.function_call) {
    const { function_call } = message;
    const toolsArr = Array.isArray(function_call)
      ? function_call
      : [function_call];
    message.role = "assistant";

    message.content = toolsArr.map((call: any) => {
      const { id, name, arguments: input } = call;
      return {
        type: "tool_use",
        id,
        name,
        input: maybeParseJSON(input),
      };
    });

    delete message.function_call;
  }

  return message;
}
