// #region file
import {
  useLlm,
  createPrompt,
  createCustomParser,
  createLlmExecutor,
} from "llm-exe";
import type { IChatMessages, ExecutionContext } from "llm-exe";

function snakeCase(str: string) {
  return str;
}
// #region prepare
export const intents = {
  book_hotel: {
    description: "when the user is asking about to booking a hotel",
  },
  book_flight: { description: "when the user is looking to book a flight" },
  rent_car: { description: "when the user is looking to rent a car" },
  unknown: {
    description: "Use this if the intent doesn't match any other options.",
  },
};

export interface IdentifyIntentInput {
  input: string;
  intents: {
    [key in keyof typeof intents]: {
      description: string;
    };
  };
  chatHistory: IChatMessages;
}

export interface IdentifyIntentOutput {
  intent: keyof typeof intents;
  intents: {
    confidence: number;
    intent: keyof typeof intents;
  }[];
}
// #endregion prepare

// #region prompt
export const PROMPT = `You are a classifier, not an assistant. You need to identify the intent of the current state of the conversation.

Read through each intent option, step by step.
For each intent option, first evaluate whether or not you think the intent matches the most recent state of the conversation.
Then, rate each intent with a confidence score between 1 and 100 representing how sure you are.

Work step by step through each possible intent to accurately identify the best match for the current state of the conversation.

Do not explain yourself and do not ask questions.

{{#if intents}}
# Intent Options
{{#each intents as | intent |}}
**{{@key}}**: {{intent.description}}
{{/each}}
{{/if}}

# Confidence Score Options
- A score ranging from 0 - 100 depending on how sure you are.

# Rules
1. Your response must be valid JSON.
2. Your response must contain the top unique intents based on your confidence.
3. Your response should not contain duplicate intents.
4. intent and confidence are required properties for each intent.

# Example Format
{ intent: "", confidence: "" }

You must follow the rules, and respond with valid JSON like the example.`;

export const INSTRUCTION = `Based on the current state of the conversation, respond with the top intent as valid JSON:`;

const prompt = (_values: IdentifyIntentInput) =>
  createPrompt<IdentifyIntentInput>("chat", PROMPT)
    .addChatHistoryPlaceholder("chatHistory")
    .addUserMessage(_values.input)
    .addSystemMessage(INSTRUCTION);
// #endregion prompt

// #region parser
export const parser = createCustomParser<IdentifyIntentOutput>(
  "IntentParser",
  (
    input,
    context: ExecutionContext<IdentifyIntentInput, IdentifyIntentOutput>
  ) => {
    const { intents: inputIntents } = context.execution.input;
    const cleanResponse = input.trim();
    const regex = /{[\s\S]+?}/g;
    const jsonStrArray = cleanResponse.match(regex);

    if (jsonStrArray && Array.isArray(jsonStrArray)) {
      const intents = jsonStrArray
        .map((a) => JSON.parse(a))
        .filter(
          (a: any) =>
            a.confidence &&
            a.intent &&
            Object.keys(inputIntents)
              .map((a) => snakeCase(a))
              .includes(snakeCase(a.intent))
        )
        .map((v) => ({
          confidence: parseInt(v?.confidence || 0),
          intent: snakeCase(v.intent) as IdentifyIntentOutput["intent"],
        }))
        .sort((a, b) => b.confidence - a.confidence);

      const [intent] = intents;
      if (intent) {
        return { intent: intent.intent, intents };
      } else {
        return { intent: "unknown", intents };
      }
    }
    return { intent: "unknown", intents: [] };
  }
);
// #endregion parser

// #region function
export async function identifyIntent(input: IdentifyIntentInput) {
  const llm = useLlm("openai.chat.v1", {
    model: "gpt-4o-mini",
    openAiApiKey: process.env.OPENAI_API_KEY,
  });

  return createLlmExecutor({
    name: "identify-intent",
    llm,
    prompt,
    parser,
  }).execute(input);
}
// #endregion function
// #endregion file
