import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

// Create the executor that generates an outline from an idea
export function createOutline<I extends { idea: string }>(input: I) {
  const outlinePrompt = createChatPrompt<I>(
    `You are a creative storyteller.
Create a brief outline for a story about "{{idea}}".
Respond only with a bullet list of the main plot points.`
  );

  const outlineParser = createParser("listToArray");

  return createLlmExecutor({
    llm: useLlm("openai.gpt-6-luna"),
    prompt: outlinePrompt,
    parser: outlineParser,
  }).execute(input);
}
