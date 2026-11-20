// #region file
import {
  utils,
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";
// #endregion imports

// #region function
export async function checkAnswer<
  I extends {
    answer: string;
    requiredWord: string;
  },
>(input: I) {
  // #region prompt
  const instruction = `You are a strict inspector.
The required word is "{{requiredWord}}".
Given the answer: "{{answer}}"

- Does it include the required word? Answer "yes" or "no".
- Is it under 10 words? Answer "yes" or "no".

Respond with a JSON object, e.g. {"hasWord": true, "underLimit": false}.`;

  const checkPrompt = createChatPrompt<I>(instruction);
  // #endregion prompt

  // #region schema
  const schema = utils.defineSchema({
    type: "object",
    properties: {
      hasWord: { type: "boolean" },
      underLimit: { type: "boolean" },
    },
    required: ["hasWord", "underLimit"],
    additionalProperties: false,
  });
  // #endregion schema

  // #region parser
  const checkParser = createParser("json", { schema });
  // #endregion parser

  return createLlmExecutor({
    llm: useLlm("openai.gpt-6-luna"),
    prompt: checkPrompt,
    parser: checkParser,
  }).execute(input);
}
// #endregion function
// #endregion file
