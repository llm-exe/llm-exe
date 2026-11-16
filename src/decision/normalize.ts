import { LlmExeError } from "@/errors";
import { scoreLevelLabel } from "./questions";
import type {
  DecisionAnswer,
  DecisionChoiceQuestion,
  DecisionQuestion,
  DecisionQuestionMap,
  DecisionResult,
  DecisionScoreQuestion,
  DecisionUsage,
} from "@/types";

/** Shared by every provider adapter: turns provider answers into ours. */

export type ResponseContext = {
  provider: string;
  model: string;
  operation: string;
};

/** A probability entry as [option value or level index, probability]. */
export type ProbabilityPair = readonly [key: unknown, probability: unknown];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function invalidResponse(
  message: string,
  context: ResponseContext,
  raw: unknown,
): LlmExeError<"llm.invalid_response_shape"> {
  let responseExcerpt: string | undefined;
  try {
    responseExcerpt = JSON.stringify(raw)?.slice(0, 500);
  } catch {
    responseExcerpt = undefined;
  }
  return new LlmExeError(message, {
    code: "llm.invalid_response_shape",
    context: {
      operation: context.operation,
      provider: context.provider,
      model: context.model,
      responseExcerpt,
    },
  });
}

/**
 * Builds an object keyed by option value or level label, with every key
 * present. A key the provider left out gets 0. Returns undefined if any pair
 * is malformed or names a key we didn't ask about.
 */
function collectProbabilities(
  keys: readonly string[],
  pairs: Iterable<readonly [string | undefined, unknown]>,
): Record<string, number> | undefined {
  // A Map, not an object, so keys like "constructor" or "__proto__" can't
  // collide with Object.prototype.
  const probabilities = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const [key, probability] of pairs) {
    if (
      key === undefined ||
      !probabilities.has(key) ||
      !isProbability(probability)
    ) {
      return undefined;
    }
    probabilities.set(key, probability);
  }
  return Object.fromEntries(probabilities);
}

/** First key with the highest probability, so ties go to the lower level. */
function mostLikely(
  keys: readonly string[],
  probabilities: Record<string, number>,
): string {
  let best = keys[0];
  for (const key of keys) {
    if (probabilities[key] > probabilities[best]) best = key;
  }
  return best;
}

export function booleanAnswer(
  probability: unknown,
): DecisionAnswer<DecisionQuestion> | undefined {
  return isProbability(probability)
    ? { type: "boolean", probability }
    : undefined;
}

export function choiceAnswer(
  question: DecisionChoiceQuestion,
  answer: {
    choice: unknown;
    confidence: unknown;
    probabilities: Iterable<ProbabilityPair> | undefined;
  },
): DecisionAnswer<DecisionChoiceQuestion> | undefined {
  if (!answer.probabilities) return undefined;
  const values = Object.keys(question.options);
  const pairs = Array.from(
    answer.probabilities,
    ([key, probability]) =>
      [typeof key === "string" ? key : undefined, probability] as const,
  );
  const probabilities = collectProbabilities(values, pairs);
  if (
    typeof answer.choice !== "string" ||
    !values.includes(answer.choice) ||
    !isProbability(answer.confidence) ||
    !probabilities
  ) {
    return undefined;
  }
  return {
    type: "choice",
    choice: answer.choice,
    confidence: answer.confidence,
    probabilities,
  };
}

/** Accepts 2 or "2". Anything else, including "2.0" or "-1", is not an index. */
function levelIndex(key: unknown): number | undefined {
  if (typeof key === "number") {
    return Number.isInteger(key) ? key : undefined;
  }
  if (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key)) {
    return Number(key);
  }
  return undefined;
}

export function scoreAnswer(
  question: DecisionScoreQuestion,
  answer: {
    score: unknown;
    confidence: unknown;
    /** Keyed by level index, not label, so an echoed label can't mismatch. */
    probabilities: Iterable<ProbabilityPair> | undefined;
  },
): DecisionAnswer<DecisionScoreQuestion> | undefined {
  if (!answer.probabilities) return undefined;
  const labels = question.levels.map(scoreLevelLabel);
  const pairs = Array.from(answer.probabilities, ([key, probability]) => {
    const index = levelIndex(key);
    return [
      index === undefined ? undefined : labels[index],
      probability,
    ] as const;
  });
  const probabilities = collectProbabilities(labels, pairs);
  if (
    !isProbability(answer.score) ||
    !isProbability(answer.confidence) ||
    !probabilities
  ) {
    return undefined;
  }
  return {
    type: "score",
    score: answer.score,
    level: mostLikely(labels, probabilities),
    confidence: answer.confidence,
    probabilities,
  };
}

export function usageFrom(raw: unknown): DecisionUsage {
  const usage = isRecord(raw) ? raw : {};
  return {
    inputTokens:
      typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
    ...(typeof usage.output_tokens === "number"
      ? { outputTokens: usage.output_tokens }
      : {}),
  };
}

/**
 * Normalizes one answer per question. Throws llm.invalid_response_shape if a
 * question has no answer or its answer doesn't fit the question.
 */
export function buildDecisionResult(options: {
  raw: unknown;
  questions: DecisionQuestionMap;
  context: ResponseContext;
  model: unknown;
  usage: unknown;
  findAnswer: (name: string) => Record<string, unknown> | undefined;
  normalize: (
    question: DecisionQuestion,
    answer: Record<string, unknown>,
  ) => DecisionAnswer<DecisionQuestion> | undefined;
}): DecisionResult<DecisionQuestionMap> {
  const { raw, questions, context, findAnswer, normalize } = options;
  const answers: [string, DecisionAnswer<DecisionQuestion>][] = [];
  for (const [name, question] of Object.entries(questions)) {
    const answer = findAnswer(name);
    const normalized =
      answer &&
      (answer.type === "refusal"
        ? ({ type: "refusal" } as const)
        : normalize(question, answer));
    if (!normalized) {
      throw invalidResponse(
        answer
          ? `Decision answer for "${name}" does not match its ${question.type} question.`
          : `Decision response has no answer for "${name}".`,
        context,
        raw,
      );
    }
    answers.push([name, normalized]);
  }
  return {
    model: typeof options.model === "string" ? options.model : context.model,
    // fromEntries defines own properties, so a question named "__proto__"
    // is stored as an answer instead of replacing the object's prototype.
    answers: Object.fromEntries(answers),
    usage: usageFrom(options.usage),
  };
}
