import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

// Create the executor that generates a story from an outline
export function createStoryFromOutline<
  I extends { idea: string; outline: string[] },
>(input: I) {
  const storyPrompt = createChatPrompt(
    `You are an accomplished novelist.
Using the outline below, write a short story that follows those points:

Outline:
{{#each outline}}
- {{this}}
{{/each}}

Begin the story now:`
  );

  return createLlmExecutor({
    llm: useLlm("openai.gpt-6-luna"),
    parser: createParser("string"),
    prompt: storyPrompt,
  }).execute(input);
}
