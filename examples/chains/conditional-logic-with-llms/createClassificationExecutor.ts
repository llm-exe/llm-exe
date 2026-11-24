import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

/**
 * Creates the classification executor to distinguish question types
 */
export function createClassificationExecutor<I extends { question: string }>(
  input: I
) {
  const prompt = createChatPrompt<I>(
    `You are an AI that labels questions as 'technical' or 'creative'.
     Question: "{{question}}"
     Label this question as 'technical' or 'creative' only.`
  );
  const parser = createParser("stringExtract", {
    enum: ["technical", "creative"],
  });
  const llm = useLlm("openai.gpt-6-luna");
  return createLlmExecutor({ llm, prompt, parser }).execute(input);
}
