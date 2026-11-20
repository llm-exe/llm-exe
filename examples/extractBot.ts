// #region file
import { useLlm, createPrompt, createParser, createLlmExecutor } from "llm-exe";
import type { IChatMessages } from "llm-exe";

// #region types
interface ExtractInformationInput {
  chatHistory: IChatMessages;
  mostRecentMessage: string;
}
// #endregion types

// #region prompt
export const PROMPT = `# Instructions: I need you to identify and extract 
the following information from the context and conversation. Reply with only 
this information, formatted as valid JSON. Do not carry on a conversation. 
Make sure you read through the context and work step-by-step to make sure 
you identify accurate information. If you do not know the value, use 
the default value.

Your response must EXACTLY follow the JSON Schema specified below:

{{>JsonSchema key='schema'}}`;

export const INSTRUCT = `Respond with:
{{>JsonSchemaExampleJson key='schema'}}`;
// #endregion prompt

// #region function
export async function extractInformation<
  S extends Record<string, any>,
  I extends ExtractInformationInput,
>(input: I, schema: S) {
  const prompt = createPrompt<I>("chat", PROMPT)
    .addChatHistoryPlaceholder("chatHistory")
    .addMessagePlaceholder(`{{mostRecentMessage}}`)
    .addSystemMessage(INSTRUCT);

  const parser = createParser("json", { schema });

  const llm = useLlm("openai.chat.v1", {
    model: "gpt-6-luna",
    openAiApiKey: process.env.OPENAI_API_KEY,
  });

  return createLlmExecutor({
    name: "extract",
    llm,
    prompt,
    parser,
  }).execute(Object.assign(input, { schema }));
}
// #endregion function
// #endregion file
