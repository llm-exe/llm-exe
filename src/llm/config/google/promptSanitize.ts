import { IChatMessages } from "@/types";
import { googleGeminiPromptMessageCallback } from "./promptSanitizeMessageCallback";
import { LlmExeError } from "@/errors";

/**
 * Merge consecutive messages with the same role by combining their parts arrays.
 * This handles parallel tool calls (multiple model functionCall parts) and
 * parallel tool results (multiple user functionResponse parts) which Gemini
 * requires to be a single message with combined parts.
 */
function mergeConsecutiveSameRole(
  messages: Record<string, any>[]
): Record<string, any>[] {
  if (messages.length <= 1) return messages;

  const merged: Record<string, any>[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = messages[i];

    if (
      curr.role === prev.role &&
      Array.isArray(prev.parts) &&
      Array.isArray(curr.parts)
    ) {
      prev.parts = [...prev.parts, ...curr.parts];
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export function googleGeminiPromptSanitize(
  _messages: string | IChatMessages,
  _inputBodyObj: Record<string, any>,
  _outputObj: Record<string, any>
) {
  /**
   * If _messages is a string, return it as is.
   */
  if (typeof _messages === "string") {
    return [{ role: "user", parts: [{ text: _messages }] }];
  }
  if (Array.isArray(_messages)) {
    if (_messages.length === 0) {
      throw new LlmExeError("Empty messages array", {
        code: "prompt.invalid_messages",
        context: {
          operation: "googleGeminiPromptSanitize",
          provider: "google",
          received: "empty array",
          expected: "a non-empty messages array",
          resolution: "Pass at least one message to the prompt.",
        },
      });
    }

    if (_messages.length === 1 && _messages[0].role === "system") {
      // if there is only one message and it is a system message, treat it as a user message
      return [{ role: "user", parts: [{ text: _messages[0].content }] }];
    }

    const hasSystemInstruction = _messages.some(
      (message) => message.role === "system"
    );

    // if there are system messages, we need to handle them differently
    if (hasSystemInstruction) {
      // remove system messages from the array
      const theSystemInstructions = _messages.filter(
        (message) => message.role === "system"
      );
      const withoutSystemInstructions = _messages.filter(
        (message) => message.role !== "system"
      );

      // add the system instructions from the messages on request.system_instruction
      _outputObj.system_instruction = {
        parts: theSystemInstructions.map((message) => ({
          text: message.content,
        })),
      };

      const result = withoutSystemInstructions.map(
        googleGeminiPromptMessageCallback
      );
      return mergeConsecutiveSameRole(result);
    }

    const result = _messages.map(googleGeminiPromptMessageCallback);
    return mergeConsecutiveSameRole(result);
  }

  throw new LlmExeError("Invalid messages format", {
    code: "prompt.invalid_messages",
    context: {
      operation: "googleGeminiPromptSanitize",
      provider: "google",
      received: typeof _messages,
      expected: "string or messages array",
      resolution: "Pass a string or an array of chat messages.",
    },
  });
}
