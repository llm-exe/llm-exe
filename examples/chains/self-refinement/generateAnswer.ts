// #region file
// #region imports
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";
// #endregion imports
// #region function
export async function generateAnswer<
  I extends { question: string; requiredWord: string },
>(input: I) {
  // #region prompt
  const instruction = `You are an expert answering the question.
    Question: "{{question}}"
    Important: The answer must include the word "{{requiredWord}}", and be under 10 words.
    Provide your answer below:`;

  // Generator executor: proposes an answer to the user's question.
  const answerPrompt = createChatPrompt<I>(instruction);
  // #endregion prompt

  return createLlmExecutor({
    prompt: answerPrompt,
    llm: useLlm("openai.gpt-6-luna"),
    parser: createParser("string"),
  }).execute(input);
}
// #endregion function
// #endregion file
