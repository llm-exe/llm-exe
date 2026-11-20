import { scoreLevelDescription, scoreLevelLabel } from "./questions";
import {
  type ProbabilityPair,
  type ResponseContext,
  booleanAnswer,
  buildDecisionResult,
  choiceAnswer,
  invalidResponse,
  isRecord,
  scoreAnswer,
} from "./normalize";
import type {
  DecisionAnswer,
  DecisionQuestion,
  DecisionQuestionMap,
  DecisionRequest,
  DecisionResult,
} from "@/types";

type OpenAiQuestion =
  | { name: string; type: "predicate"; instructions: string }
  | {
      name: string;
      type: "choice";
      instructions: string;
      choices: { value: string; description: string }[];
    }
  | {
      name: string;
      type: "score";
      instructions: string;
      levels: { label: string; description?: string }[];
    };

function toOpenAiQuestion(
  name: string,
  question: DecisionQuestion,
): OpenAiQuestion {
  switch (question.type) {
    case "boolean":
      return { name, type: "predicate", instructions: question.instructions };
    case "choice":
      return {
        name,
        type: "choice",
        instructions: question.instructions,
        choices: Object.entries(question.options).map(
          ([value, description]) => ({ value, description }),
        ),
      };
    case "score":
      return {
        name,
        type: "score",
        instructions: question.instructions,
        levels: question.levels.map((level) => {
          const description = scoreLevelDescription(level);
          return description === undefined
            ? { label: scoreLevelLabel(level) }
            : { label: scoreLevelLabel(level), description };
        }),
      };
  }
}

export function toOpenAiDecisionBody(model: string, request: DecisionRequest) {
  return {
    model,
    // Plain text goes in as-is. JSON goes in as an input_json part, which
    // OpenAI only accepts inside a user message.
    input:
      typeof request.input === "string"
        ? request.input
        : [
            {
              role: "user",
              content: [{ type: "input_json", data: request.input }],
            },
          ],
    questions: Object.entries(request.questions).map(([name, question]) =>
      toOpenAiQuestion(name, question),
    ),
  };
}

/** OpenAI sends probabilities as an array of { value, probability }. */
function pairsFrom(entries: unknown): ProbabilityPair[] | undefined {
  if (!Array.isArray(entries)) return undefined;
  return entries.map((entry) =>
    isRecord(entry) ? [entry.value, entry.probability] : [undefined, undefined],
  );
}

const OPENAI_TYPE_FOR = {
  boolean: "predicate",
  choice: "choice",
  score: "score",
} as const;

function normalizeAnswer(
  question: DecisionQuestion,
  answer: Record<string, unknown>,
): DecisionAnswer<DecisionQuestion> | undefined {
  if (answer.type !== OPENAI_TYPE_FOR[question.type]) return undefined;
  switch (question.type) {
    case "boolean":
      return booleanAnswer(answer.probability);
    case "choice":
      return choiceAnswer(question, {
        choice: answer.choice,
        confidence: answer.confidence,
        probabilities: pairsFrom(answer.probabilities),
      });
    case "score":
      return scoreAnswer(question, {
        score: answer.score,
        confidence: answer.confidence,
        probabilities: pairsFrom(answer.probabilities),
      });
  }
}

/**
 * Turns an OpenAI /v1/decisions response into answers keyed by question name.
 * OpenAI returns answers as an array with a `name` on each.
 */
export function fromOpenAiDecisionResponse(
  raw: unknown,
  questions: DecisionQuestionMap,
  provider: { provider: string; model: string },
): DecisionResult<DecisionQuestionMap> {
  const context: ResponseContext = {
    ...provider,
    operation: "openai.decisions.response",
  };
  if (!isRecord(raw) || !Array.isArray(raw.answers)) {
    throw invalidResponse(
      "Decision response has no answers array.",
      context,
      raw,
    );
  }
  const byName = new Map<string, Record<string, unknown>>();
  for (const answer of raw.answers) {
    if (isRecord(answer) && typeof answer.name === "string") {
      byName.set(answer.name, answer);
    }
  }
  return buildDecisionResult({
    raw,
    questions,
    context,
    model: raw.model,
    usage: raw.usage,
    findAnswer: (name) => byName.get(name),
    normalize: normalizeAnswer,
  });
}
