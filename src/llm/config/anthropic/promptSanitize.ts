import { IChatMessage, IChatMessages } from "@/types";
import {
  anthropicPromptMessageCallback,
  AnthropicPromptSanitizeOptions,
} from "./promptSanitizeMessageCallback";

/**
 * Merge consecutive messages with the same role when both have array content.
 * This handles parallel tool calls (multiple assistant tool_use blocks) and
 * parallel tool results (multiple user tool_result blocks) which Anthropic
 * requires to be a single message with combined content arrays.
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
      Array.isArray(prev.content) &&
      Array.isArray(curr.content)
    ) {
      prev.content = [...prev.content, ...curr.content];
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export function anthropicPromptSanitize(
  _messages: string | IChatMessages,
  _inputBodyObj: Record<string, any>,
  _outputObj: Record<string, any>,
  _options: AnthropicPromptSanitizeOptions = {}
) {
  const toAnthropicMessage = (m: IChatMessage) =>
    anthropicPromptMessageCallback(m, _options);

  if (typeof _messages === "string") {
    return [{ role: "user", content: _messages } as IChatMessage].map(
      toAnthropicMessage
    );
  }

  const [first, ...messages] = [
    ..._messages.map((a) => ({ ...a }) as IChatMessage),
  ];

  // if a single system message is passed in:
  // - we'll treat as a user message
  if (first.role === "system" && messages.length === 0) {
    return [
      { role: "user", content: first.content } as IChatMessage,
      ...messages,
    ].map(toAnthropicMessage);
  }

  // if more than one message is passed in, and the first is a system message:
  //   - we'll "delete" the system message and set it to the output object
  //   - and return the rest of the messages
  if (first.role === "system" && messages.length > 0) {
    _outputObj.system = first.content;
    const result = (
      messages.map((m) => {
        if (m.role === "system") {
          return { ...m, role: "user" };
        }
        return m;
      }) as IChatMessage[]
    ).map(toAnthropicMessage);
    return mergeConsecutiveSameRole(result);
  }

  // otherwise, don't make assumptions?
  const result = (
    [
      first,
      ...messages.map((m) => {
        if (m.role === "system") {
          return { ...m, role: "user" };
        }
        return m;
      }),
    ] as IChatMessage[]
  ).map(toAnthropicMessage);
  return mergeConsecutiveSameRole(result);
}
