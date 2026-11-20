// #region file
import {
  utils,
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
  createCustomParser,
} from "llm-exe";
import type { IChatMessages } from "llm-exe";

// #region prompt
const PROMPT = `You need to work through the list below step-by-step and
identify if each statement is true or false. Use the conversation and context
below to help make a decision. Do not explain your answer, and do not use 
punctuation.
  
{{#if statements}}
The List:
{{#each statements as | statements |}}
- {{ statements }}
{{/each}}
{{/if}}

Conversation:
{{>DialogueHistory key='chatHistory'}}

Most Recent Message: {{ input }}`;

const INSTRUCTION = `Your response should be valid JSON in the following format: ${JSON.stringify(
  [
    {
      statement: "<a statement from the list>",
      answer: "<true or false>",
      confidence: "<number between 1 and 100. how confident are you>",
    },
  ]
)}`;
// #endregion prompt

// #region parser
export const VerifyParser = createCustomParser(
  "VerifyParser",
  (input, _context) => {
    const schema = utils.defineSchema({
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string", default: "" },
          answer: { type: "string", default: "" },
          confidence: { type: "integer", default: 0 },
        },
        required: ["statement", "answer", "confidence"],
        additionalProperties: false,
      },
    });

    const parseJson = createParser("json", { schema }).parse(input);

    const didAllPass =
      parseJson.filter((a: any) => a.answer === "true").length ===
      parseJson.length;

    return {
      passed: didAllPass,
      results: parseJson,
    };
  }
);
// #endregion parser

// #region function

export async function checkPolicy(input: {
  statements: string[]; // the list of statements to check
  chatHistory: IChatMessages; // the chat history
  input: string; // the most recent user message
}) {
  const llm = useLlm("openai.chat.v1", {
    model: "gpt-6-luna",
    openAiApiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = createChatPrompt(PROMPT).addSystemMessage(INSTRUCTION);
  return createLlmExecutor({
    llm,
    prompt,
    parser: VerifyParser,
  }).execute(input);
}
// #endregion function
// #endregion file
