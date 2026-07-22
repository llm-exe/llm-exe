import { IChatMessage, IChatMessages } from "@/types";
import {
  anthropicPromptMessageCallback,
  AnthropicPromptSanitizeOptions,
} from "./promptSanitizeMessageCallback";

// Models that 400 on a trailing assistant message (prefill): the 4.6+/5
// generation. Issue #503 and Anthropic's migration guide name opus-4-6,
// opus-4-7, and sonnet-4-6; opus-4-8, sonnet-5, and fable-5 belong to the same
// generation and are grouped here for the same reason the sampling-param and
// adaptive-thinking lists in `anthropic/index.ts` group this generation. The
// 4.5 generation (opus/sonnet/haiku 4.5) still supports prefills and is
// excluded. Kept as its own list because prefill support is a distinct model
// capability from adaptive thinking / sampling-param handling, even though the
// membership currently coincides.
const PREFILL_UNSUPPORTED_MODELS = [
  "claude-opus-4-6",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-fable-5",
];

function modelBlocksPrefill(model: string | undefined): boolean {
  if (!model) return false;
  return PREFILL_UNSUPPORTED_MODELS.some(
    (prefix) => model === prefix || model.startsWith(`${prefix}-`)
  );
}

function warnIfTrailingAssistantMessage(
  messages: Record<string, any>[],
  model: string | undefined
): void {
  if (messages.length === 0) return;
  const last = messages[messages.length - 1];
  if (last.role === "assistant" && modelBlocksPrefill(model)) {
    console.warn(
      `[llm-exe] The model "${model}" does not support assistant message prefills. ` +
        `The last message in the messages array has role "assistant", which will cause a 400 error from the Anthropic API. ` +
        `Remove the trailing assistant message or use a model that supports prefills.`
    );
  }
}

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
    const result = mergeConsecutiveSameRole(
      (
        messages.map((m) => {
          if (m.role === "system") {
            return { ...m, role: "user" };
          }
          return m;
        }) as IChatMessage[]
      ).map(toAnthropicMessage)
    );
    warnIfTrailingAssistantMessage(result, _inputBodyObj.model);
    return result;
  }

  // otherwise, don't make assumptions?
  const result = mergeConsecutiveSameRole(
    (
      [
        first,
        ...messages.map((m) => {
          if (m.role === "system") {
            return { ...m, role: "user" };
          }
          return m;
        }),
      ] as IChatMessage[]
    ).map(toAnthropicMessage)
  );
  warnIfTrailingAssistantMessage(result, _inputBodyObj.model);
  return result;
}
