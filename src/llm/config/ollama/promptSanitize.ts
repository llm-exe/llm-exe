import { IChatMessages } from "@/types";
import { LlmExeError } from "@/errors";
import {
  isImageUrlContentBlock,
  parseImageUrl,
} from "../_utils/imageContent";

/**
 * Ollama's native /api/chat expects string content plus a per-message
 * `images` array of raw base64 (no data: prefix), so array content gets
 * split: text blocks join into the content string, image blocks move to
 * `images`.
 */
export function ollamaPromptSanitize(_messages: string | IChatMessages) {
  if (typeof _messages === "string") {
    return [{ role: "user", content: _messages }];
  }

  return _messages.map((_message) => {
    if (!Array.isArray(_message.content)) {
      return _message;
    }

    const message: Record<string, any> = { ..._message };
    const textParts: string[] = [];
    const images: string[] = [];

    for (const block of message.content) {
      if (isImageUrlContentBlock(block)) {
        if (message.role === "function") {
          throw new LlmExeError(
            "Images in tool results are not supported by ollama",
            {
              code: "prompt.invalid_messages",
              context: {
                operation: "ollamaPromptSanitize",
                provider: "ollama.chat",
                received: "an image_url content block on a function message",
                expected: "text content blocks",
                resolution:
                  "Ollama only honours the per-message images array on user messages, so an image on a tool result is dropped. Return text from the tool and send the image as a separate user message.",
              },
            }
          );
        }
        const parsed = parseImageUrl(block.image_url.url, {
          operation: "ollamaPromptSanitize",
          provider: "ollama.chat",
        });
        if (parsed.kind === "url") {
          throw new LlmExeError("Image URLs are not supported by ollama", {
            code: "prompt.invalid_messages",
            context: {
              operation: "ollamaPromptSanitize",
              provider: "ollama.chat",
              received: parsed.url,
              expected: "a base64 data: URI",
              resolution:
                "Ollama does not fetch remote images. Base64-encode the image and pass it as a data: URI (data:image/png;base64,...).",
            },
          });
        }
        images.push(parsed.data);
      } else if (typeof (block as Record<string, any>)?.text === "string") {
        textParts.push((block as Record<string, any>).text);
      } else {
        throw new LlmExeError("Unsupported content block for ollama", {
          code: "prompt.invalid_messages",
          context: {
            operation: "ollamaPromptSanitize",
            provider: "ollama.chat",
            received: block,
            expected: "text or image_url content blocks",
            resolution:
              "Ollama messages only support text and base64 images.",
          },
        });
      }
    }

    message.content = textParts.join("\n");
    if (images.length > 0) {
      message.images = images;
    }
    return message;
  });
}
