import { IChatMessages } from "@/types";
import { LlmExeError } from "@/errors";
import { maybeParseJSON } from "@/utils";
import {
  isImageUrlContentBlock,
  parseImageUrl,
} from "../_utils/imageContent";

/**
 * Ollama's native /api/chat expects string content plus a per-message
 * `images` array of raw base64 (no data: prefix), so array content gets
 * split: text blocks join into the content string, image blocks move to
 * `images`.
 *
 * Tool traffic is converted too: llm-exe's internal `function_call` becomes
 * ollama's `tool_calls: [{ function: { name, arguments } }]` — with
 * `arguments` as an object, not a JSON string — and `role: "function"`
 * becomes `role: "tool"`.
 */
export function ollamaPromptSanitize(_messages: string | IChatMessages) {
  if (typeof _messages === "string") {
    return [{ role: "user", content: _messages }];
  }

  return _messages.map((_message) => {
    const message: Record<string, any> = { ..._message };

    if (message.role === "function") {
      // ollama tool results are plain `role: "tool"` messages with the
      // stringified result as content — no id/name on the wire
      message.role = "tool";
      delete message.id;
      delete message.name;
    }

    if (message.function_call) {
      const toolsArr = Array.isArray(message.function_call)
        ? message.function_call
        : [message.function_call];
      message.role = "assistant";
      message.tool_calls = toolsArr.map((call: any) => ({
        function: {
          name: call.name,
          arguments: maybeParseJSON(call.arguments),
        },
      }));
      delete message.function_call;
      if (message.content === null || typeof message.content === "undefined") {
        // ollama types content as a string; a tool call carries no text
        message.content = "";
      }
    }

    if (!Array.isArray(message.content)) {
      return message;
    }

    const textParts: string[] = [];
    const images: string[] = [];

    for (const block of message.content) {
      if (isImageUrlContentBlock(block)) {
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
