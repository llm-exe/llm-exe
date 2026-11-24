import {
  useLlm,
  createParser,
  createChatPrompt,
  createLlmExecutor,
} from "llm-exe";

/**
 * Creates the executor for answering factual/technical questions
 */
export function createFactualExecutor<I extends { question: string }>(
  input: I
) {
  const prompt = createChatPrompt<I>(
    `You are a precise expert. Answer the following question with a factual, concise explanation.
       Question: "{{question}}"
       Answer:`
  );
  return createLlmExecutor({
    llm: useLlm("openai.gpt-6-luna"),
    parser: createParser("string"),
    prompt,
  }).execute(input);
}
