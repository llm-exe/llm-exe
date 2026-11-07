import { PromptOptions } from "./../interfaces/prompt";
import { PromptType, ChatPromptOptions } from "@/types";
import { TextPrompt } from "./text";
import { ChatPrompt } from "./chat";

/**
 * `createPrompt` Creates a new instance of a prompt.
 *
 * @param type Define whether using chat or string prompt
 * @param initialPromptMessage (optional) A message to use for an initial system message.
 */
export function createPrompt<I extends Record<string, any>>(
  type: Extract<PromptType, "text">,
  initialPromptMessage?: string,
  options?: PromptOptions
): TextPrompt<I>;
export function createPrompt<I extends Record<string, any>>(
  type: Extract<PromptType, "chat">,
  initialPromptMessage?: string,
  options?: ChatPromptOptions
): ChatPrompt<I>;
export function createPrompt<I extends Record<string, any>>(
  type?: PromptType,
  initialPromptMessage?: string,
  options?: PromptOptions | ChatPromptOptions
): TextPrompt<I>;

export function createPrompt<I extends Record<string, any>>(
  type?: PromptType,
  initialPromptMessage?: string,
  options?: PromptOptions | ChatPromptOptions
) {
  switch (type) {
    case "chat":
      return new ChatPrompt<I>(initialPromptMessage, options);
    default:
      return new TextPrompt<I>(initialPromptMessage, options);
  }
}

/**
 * `createChatPrompt` Creates a new instance of a chat prompt.
 *
 * @param initialSystemPromptMessage (optional) A message to use for an initial system message.
 */
export function createChatPrompt<I extends Record<string, any>>(
  initialSystemPromptMessage?: string,
  options?: ChatPromptOptions
): ChatPrompt<I> {
  return new ChatPrompt<I>(initialSystemPromptMessage, options);
}
