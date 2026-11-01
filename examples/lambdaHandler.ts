// #region file
// #region setup
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

// Created once at module scope, so warm Lambda invocations reuse it.
const classifyFeedback = createLlmExecutor({
  name: "classify-feedback",
  llm: useLlm("openai.gpt-4o-mini", {
    openAiApiKey: process.env.OPENAI_API_KEY,
    timeout: 20000, // stay well below your Lambda's own timeout
    numOfAttempts: 2,
  }),
  prompt: createChatPrompt<{ feedback: string }>(
    "Classify this customer feedback as praise, complaint, or question: {{feedback}}"
  ),
  parser: createParser("stringExtract", {
    enum: ["praise", "complaint", "question"],
  }),
});
// #endregion setup

// #region handler
export async function handler(event: { feedback: string }) {
  const category = await classifyFeedback.execute({
    feedback: event.feedback,
  });

  // category is typed as "praise" | "complaint" | "question"
  return {
    statusCode: 200,
    body: JSON.stringify({ category }),
  };
}
// #endregion handler
// #endregion file
