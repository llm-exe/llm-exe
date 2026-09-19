import {
  createChatPrompt,
  createLlmFunctionExecutor,
  createParser,
  useLlm,
} from "llm-exe";

const tools = [
  {
    name: "getWeather",
    description: "Gets the weather based on user's coordinates",
    parameters: {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "convertCurrency",
    description: "Convert currency from one to another.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amount: { type: "number" },
      },
      required: ["from", "to", "amount"],
    },
  },
];

export async function llmUsingToolsSimple(message: string, history: any[]) {
  const llm = useLlm("xai.grok-4.3");
  const prompt = createChatPrompt(
    "You are a helpful assistant who ONLY uses tools. Do not talk, just use tools."
  );

  prompt.addFromHistory(history);

  if (message) {
    prompt.addUserMessage(message);
  }

  const parser = createParser("string");

  return createLlmFunctionExecutor({
    llm,
    prompt,
    parser,
  }).execute({}, { functions: tools, functionCall: "auto" });
}
