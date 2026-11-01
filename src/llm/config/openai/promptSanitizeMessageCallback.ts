import { LlmExeError } from "@/errors";
import { isImageUrlContentBlock } from "../_utils/imageContent";

export function openaiPromptMessageCallback(_message: any) {
  let message = { ..._message };

  if (Array.isArray(message.content)) {
    // the previous loose content typing accepted image blocks with any
    // `type` (e.g. "image"); normalize them to OpenAI's "image_url"
    message.content = message.content.map((block: any) =>
      isImageUrlContentBlock(block) && block.type !== "image_url"
        ? { ...block, type: "image_url" }
        : block
    );
  }

  if (message.role === "function") {
    // Chat Completions `tool` messages take text only — an image block here is
    // accepted by the type but rejected by the API, so fail in llm-exe with a
    // resolution instead of surfacing a provider 400. Text-only block arrays
    // are fine and pass through.
    if (
      Array.isArray(message.content) &&
      message.content.some(isImageUrlContentBlock)
    ) {
      throw new LlmExeError(
        "Image content is not supported in tool results by this provider",
        {
          code: "prompt.invalid_messages",
          context: {
            operation: "openaiPromptMessageCallback",
            provider: "openai-compatible",
            received: "a tool result containing an image content block",
            expected: "text-only tool result content",
            resolution:
              "Return text from the tool and send the image as a separate user message, or use an Anthropic model, which accepts images inside tool results.",
          },
        }
      );
    }

    message.role = "tool";
    message.tool_call_id = message.id;
    delete message.id;
  }

  if (message?.function_call) {
    const { function_call } = message;
    const toolsArr = Array.isArray(function_call)
      ? function_call
      : [function_call];
    message.role = "assistant";
    message.tool_calls = toolsArr.map((call: any) => {
      const { id, ...functionCall } = call;
      return {
        id,
        type: "function",
        function: functionCall,
      };
    });
    delete message.function_call;
  }

  // do openai-specific transformations
  return message;
}
