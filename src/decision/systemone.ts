import { scoreLevelDescription, scoreLevelLabel } from "./questions";
import {
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
  DecisionScoreLevel,
} from "@/types";

/**
 * The "System One" wire format, shared by TypeSafe Jev and Cloudflare Clef.
 * Questions and answers are objects keyed by question name.
 */

type SystemOneQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

/**
 * System One score levels are plain strings. A level's description would be
 * lost if we sent only the label, so it's appended. Answers are matched by
 * level index, so the label we send doesn't have to round-trip.
 */
function systemOneLevel(level: DecisionScoreLevel): string {
  const label = scoreLevelLabel(level);
  const description = scoreLevelDescription(level);
  return description ? `${label}: ${description}` : label;
}

function toSystemOneQuestion(question: DecisionQuestion): SystemOneQuestion {
  switch (question.type) {
    case "boolean":
      return { type: "noul", instructions: question.instructions };
    case "choice":
      return {
        type: "choice",
        instructions: question.instructions,
        criteria: { ...question.options },
      };
    case "score":
      return {
        type: "score",
        instructions: question.instructions,
        criteria: question.levels.map(systemOneLevel),
      };
  }
}

export function toSystemOneBody(model: string, request: DecisionRequest) {
  return {
    model,
    // System One takes text or any JSON value as `state` directly.
    state: request.input,
    questions: Object.fromEntries(
      Object.entries(request.questions).map(([name, question]) => [
        name,
        toSystemOneQuestion(question),
      ]),
    ),
  };
}

const SYSTEM_ONE_TYPE_FOR = {
  boolean: "noul",
  choice: "choice",
  score: "score",
} as const;

/** System One sends probabilities as an object keyed by value or level index. */
function pairsFrom(probabilities: unknown) {
  return isRecord(probabilities) ? Object.entries(probabilities) : undefined;
}

function normalizeAnswer(
  question: DecisionQuestion,
  answer: Record<string, unknown>,
): DecisionAnswer<DecisionQuestion> | undefined {
  if (answer.type !== SYSTEM_ONE_TYPE_FOR[question.type]) return undefined;
  switch (question.type) {
    case "boolean":
      return booleanAnswer(answer.noul);
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
 * Turns a System One response into answers keyed by question name.
 * Cloudflare's REST API may wrap the result in { result, success, errors },
 * so a `result` object holding `answers` is unwrapped first.
 */
export function fromSystemOneResponse(
  raw: unknown,
  questions: DecisionQuestionMap,
  provider: { provider: string; model: string },
): DecisionResult<DecisionQuestionMap> {
  const context: ResponseContext = {
    ...provider,
    operation: "systemone.response",
  };
  const body =
    isRecord(raw) && isRecord(raw.result) && isRecord(raw.result.answers)
      ? raw.result
      : raw;
  if (!isRecord(body) || !isRecord(body.answers)) {
    throw invalidResponse(
      "Decision response has no answers object.",
      context,
      raw,
    );
  }
  const answers = body.answers;
  return buildDecisionResult({
    raw,
    questions,
    context,
    model: body.model,
    usage: body.usage,
    findAnswer: (name) => {
      const answer = Object.prototype.hasOwnProperty.call(answers, name)
        ? answers[name]
        : undefined;
      return isRecord(answer) ? answer : undefined;
    },
    normalize: normalizeAnswer,
  });
}
