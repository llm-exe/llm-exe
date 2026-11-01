// #region file
// #region imports
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";
// #endregion imports

// #region prompts
// Prompts live here (or in their own module) - not inline in business logic.
// The template declares the variables it needs; TypeScript enforces them.
export const SUPPORT_REPLY_PROMPT = `You are a support agent for {{companyName}}.

Write a brief, friendly reply to the customer message below.
- Do not promise refunds or specific timelines.
- If the issue needs a human, say the team will follow up.

Customer message:
{{message}}`;
// #endregion prompts

// #region function
export interface DraftSupportReplyInput {
  companyName: string;
  message: string;
}

export async function draftSupportReply(input: DraftSupportReplyInput) {
  const llm = useLlm("openai.gpt-4o-mini");
  const prompt = createChatPrompt<DraftSupportReplyInput>(SUPPORT_REPLY_PROMPT);
  const parser = createParser("string");

  return createLlmExecutor({
    name: "draft-support-reply",
    llm,
    prompt,
    parser,
  }).execute(input);
}
// #endregion function

// #region testing
// Because the prompt is data, you can render it without calling an LLM -
// useful for snapshot tests and reviewing exactly what the model will see.
export function renderSupportReplyPrompt(input: DraftSupportReplyInput) {
  return createChatPrompt<DraftSupportReplyInput>(
    SUPPORT_REPLY_PROMPT
  ).format(input);
}
// #endregion testing
// #endregion file
