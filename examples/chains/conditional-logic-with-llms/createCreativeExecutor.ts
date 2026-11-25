import {
  useLlm,
  createParser,
  createChatPrompt,
  createLlmExecutor,
} from "llm-exe";

/**
 * Creates the executor for answering creative/story-style questions
 */
export function createCreativeExecutor<I extends { question: string }>(
  input: I
) {
  const prompt = createChatPrompt<{ question: string }>(
    `You are an imaginative storyteller. Answer the question in a creative, story-like manner.
         Question: "{{question}}"
         Answer:`
  );
  return createLlmExecutor({
    llm: useLlm("openai.gpt-6-luna"),
    parser: createParser("string"),
    prompt,
  }).execute(input);
}
