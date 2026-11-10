import { LlmExeError } from "@/errors";
import { scoreLevelDescription, scoreLevelLabel } from "./questions";
import type {
  DecisionAnswer,
  DecisionChoiceQuestion,
  DecisionQuestion,
  DecisionQuestionMap,
  DecisionRequest,
  DecisionResult,
  DecisionScoreQuestion,
} from "@/types";

/** OpenAI accepts up to 400 questions per request. */
export const OPENAI_MAX_QUESTIONS = 400;

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

type ResponseContext = { provider: string; model: string };

function invalidResponse(
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
      operation: "openai.decisions.response",
      provider: context.provider,
      model: context.model,
      responseExcerpt,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * OpenAI returns probabilities as an array. Answers expose them as an object
 * keyed by option or level, with every key present. A key the provider left
 * out gets 0.
 */
function probabilitiesFor(
  keys: readonly string[],
  entries: unknown,
  readKey: (entry: Record<string, unknown>) => string | undefined,
): Record<string, number> | undefined {
  if (!Array.isArray(entries)) return undefined;
  // A Map, not an object, so keys like "constructor" or "__proto__" can't
  // collide with Object.prototype.
  const probabilities = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const entry of entries) {
    if (!isRecord(entry) || !isProbability(entry.probability)) {
      return undefined;
    }
    const key = readKey(entry);
    if (key === undefined || !probabilities.has(key)) return undefined;
    probabilities.set(key, entry.probability);
  }
  return Object.fromEntries(probabilities);
}

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

function normalizeChoice(
  question: DecisionChoiceQuestion,
  answer: Record<string, unknown>,
): DecisionAnswer<DecisionChoiceQuestion> | undefined {
  const values = Object.keys(question.options);
  const probabilities = probabilitiesFor(
    values,
    answer.probabilities,
    (entry) => (typeof entry.value === "string" ? entry.value : undefined),
  );
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

function normalizeScore(
  question: DecisionScoreQuestion,
  answer: Record<string, unknown>,
): DecisionAnswer<DecisionScoreQuestion> | undefined {
  const labels = question.levels.map(scoreLevelLabel);
  // Match entries by level index (`value`) so a provider that echoes a
  // trimmed or re-cased label still lines up with our levels.
  const probabilities = probabilitiesFor(
    labels,
    answer.probabilities,
    (entry) =>
      typeof entry.value === "number" && Number.isInteger(entry.value)
        ? labels[entry.value]
        : undefined,
  );
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

const OPENAI_TYPE_FOR = {
  boolean: "predicate",
  choice: "choice",
  score: "score",
} as const;

function normalizeAnswer(
  question: DecisionQuestion,
  answer: Record<string, unknown>,
): DecisionAnswer<DecisionQuestion> | undefined {
  if (answer.type === "refusal") return { type: "refusal" };
  if (answer.type !== OPENAI_TYPE_FOR[question.type]) return undefined;
  switch (question.type) {
    case "boolean":
      return isProbability(answer.probability)
        ? { type: "boolean", probability: answer.probability }
        : undefined;
    case "choice":
      return normalizeChoice(question, answer);
    case "score":
      return normalizeScore(question, answer);
  }
}

/**
 * Turns an OpenAI /v1/decisions response into answers keyed by question name.
 * Throws llm.invalid_response_shape if any question is missing an answer or
 * an answer doesn't match its question.
 */
export function fromOpenAiDecisionResponse(
  raw: unknown,
  questions: DecisionQuestionMap,
  context: ResponseContext,
): DecisionResult<DecisionQuestionMap> {
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

  const answers: [string, DecisionAnswer<DecisionQuestion>][] = [];
  for (const [name, question] of Object.entries(questions)) {
    const answer = byName.get(name);
    const normalized = answer && normalizeAnswer(question, answer);
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

  const usage = isRecord(raw.usage) ? raw.usage : {};
  return {
    model: typeof raw.model === "string" ? raw.model : context.model,
    // fromEntries defines own properties, so a question named "__proto__"
    // is stored as an answer instead of replacing the object's prototype.
    answers: Object.fromEntries(answers),
    usage: {
      inputTokens:
        typeof usage.input_tokens === "number" ? usage.input_tokens : 0,
      ...(typeof usage.output_tokens === "number"
        ? { outputTokens: usage.output_tokens }
        : {}),
    },
  };
}
