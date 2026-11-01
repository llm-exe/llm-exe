// #region file
// #region imports
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";
// #endregion imports

// #region prompt
export const PROMPT = `Answer the following question with only "yes" or "no".

Do not explain your reasoning. Do not add punctuation. If you are unsure,
make your best judgment call - you must answer yes or no.

Question: {{question}}`;
// #endregion prompt

// #region function
export async function yesNo(question: string): Promise<boolean> {
  const llm = useLlm("openai.gpt-4o-mini");
  const prompt = createChatPrompt<{ question: string }>(PROMPT);
  const parser = createParser("boolean", { match: "extract" });

  return createLlmExecutor({
    name: "yes-no-decision",
    llm,
    prompt,
    parser,
  }).execute({ question });
}
// #endregion function
// #endregion file
