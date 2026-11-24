// #region file
// #region imports
import { useLlm, createPrompt, createParser, createLlmExecutor } from "llm-exe";
// #endregion imports

// #region prompt
export const PROMPT = `We are conducting a test, follow the instructions exactly.

Do not ask questions or make conversation.

The user will provide an input, you need to reply only with:

"Hello World, you said <and then insert here what they said>".

So for example, if they say "Hello", you should reply only with: 

Hello World, you said Hello.`;
// #endregion prompt

// #region function
export async function helloWorld(input: string) {
  const llm = useLlm("openai.gpt-6-luna");
  const prompt = createPrompt("chat", PROMPT);
  const parser = createParser("string");

  prompt.addUserMessage(input);

  return createLlmExecutor({
    name: "extract",
    llm,
    prompt,
    parser,
  }).execute({});
}
// #endregion function
// #endregion file
