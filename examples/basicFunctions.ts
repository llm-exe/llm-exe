import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";
import type { BaseLlm } from "llm-exe";
/**
 *
 */
// #region IntroduceSharedInstructions
const PROMPT = `Based on the user input and time of day,
come up with a list of greetings we could say to the user.

You must reply with a list of relevant greetings. For example:
- <greeting option 1>
- <greeting option 2>
- <greeting option 3>

The time of day is: {{timeOfDay}}

The user said: {{userInput}}`;

type TimeOfDay = "morning" | "afternoon" | "evening";

interface ExampleInput {
  userInput: string;
  timeOfDay: TimeOfDay;
}
// #endregion IntroduceSharedInstructions

// #region llmExecutorExample
export function llmExecutorExample<I extends ExampleInput>() {
  const llm = useLlm("openai.gpt-6-luna", {});
  const prompt = createChatPrompt<I>(PROMPT);
  const parser = createParser("listToArray");
  return createLlmExecutor({
    prompt,
    parser,
    llm,
  });
}
// #endregion llmExecutorExample

// #region llmExecutorExampleExecute
export async function llmExecutorExampleExecuteExecute<I extends ExampleInput>(
  input: I
) {
  const llm = useLlm("openai.gpt-6-luna", {});
  const prompt = createChatPrompt<I>(PROMPT);
  const parser = createParser("listToArray");
  return createLlmExecutor({
    prompt,
    parser,
    llm,
  }).execute(input);
}
// #endregion llmExecutorExampleExecute

// #region llmExecutorExampleNeedsLlm
export async function llmExecutorExampleNeedsLlm<I extends ExampleInput>(
  llm: BaseLlm,
  input: I
) {
  const prompt = createChatPrompt<I>(PROMPT);
  const parser = createParser("listToArray");
  return createLlmExecutor({
    prompt,
    parser,
    llm,
  }).execute(input);
}
// #endregion llmExecutorExampleNeedsLlm

/**
 *
 */
const PROMPT2 = `Based on the user input, which direction should we move next?

{{#each previousSteps as step}}
We moved {{step.direction}}
This happened: {{step.result}}
{{/each}}`;

interface ExampleInput {
  userInput: string;
  previousSteps: {
    direction: "forward" | "back" | "left" | "right";
    result: string;
  }[];
}

export function llmExecutorExample2<I extends ExampleInput>() {
  const llm = useLlm("openai.gpt-6-luna", {});
  const prompt = createChatPrompt<I>(PROMPT2);
  const parser = createParser("stringExtract", {
    enum: ["forward", "back", "left", "right"],
  });

  return createLlmExecutor({
    prompt,
    parser,
    llm,
  });
}
