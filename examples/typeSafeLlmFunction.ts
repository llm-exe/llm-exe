// #region file
// #region imports
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
  defineSchema,
} from "llm-exe";
// #endregion imports

// #region schema
export const reviewSchema = defineSchema({
  type: "object",
  properties: {
    sentiment: {
      type: "string",
      enum: ["positive", "neutral", "negative"],
      description: "The overall sentiment of the review.",
    },
    summary: {
      type: "string",
      description: "A one-sentence summary of the review.",
    },
    actionNeeded: {
      type: "boolean",
      description: "Does this review require a follow-up from support?",
    },
  },
  required: ["sentiment", "summary", "actionNeeded"],
  additionalProperties: false,
});
// #endregion schema

// #region prompt
export const PROMPT = `Analyze the customer product review below.

Respond with only valid JSON. Your response must EXACTLY follow this JSON Schema:

{{>JsonSchema key='schema'}}

Review:
{{review}}`;
// #endregion prompt

// #region function
export async function analyzeReview(review: string) {
  const llm = useLlm("openai.gpt-4o-mini");
  const prompt = createChatPrompt<{
    review: string;
    schema: typeof reviewSchema;
  }>(PROMPT);
  const parser = createParser("json", { schema: reviewSchema });

  return createLlmExecutor({
    name: "analyze-review",
    llm,
    prompt,
    parser,
  }).execute({ review, schema: reviewSchema });
}
// #endregion function
// #endregion file
