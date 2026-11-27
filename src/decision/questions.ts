import { LlmExeError } from "@/errors";
import type {
  DecisionQuestion,
  DecisionQuestionMap,
  DecisionScoreLevel,
} from "@/types";

// The strictest limits across the providers we target (OpenAI decisions,
// System One / Clef), so one question map works with all of them. Only the
// question count differs per provider and is passed in.
const QUESTION_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;
const MAX_CHOICE_OPTIONS = 255;
const MIN_SCORE_LEVELS = 2;
const MAX_SCORE_LEVELS = 10;

export function scoreLevelLabel(level: DecisionScoreLevel): string {
  return typeof level === "string" ? level : level.label;
}

export function scoreLevelDescription(
  level: DecisionScoreLevel,
): string | undefined {
  return typeof level === "string" ? undefined : level.description;
}

function invalidQuestion(
  message: string,
  option: string,
  operation: string,
): LlmExeError<"configuration.incompatible_options"> {
  return new LlmExeError(message, {
    code: "configuration.incompatible_options",
    context: { operation, option },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertValidQuestion(
  name: string,
  question: unknown,
  operation: string,
): asserts question is DecisionQuestion {
  const at = `questions.${name}`;
  if (!isPlainObject(question)) {
    throw invalidQuestion(
      `Question "${name}" must be an object.`,
      at,
      operation,
    );
  }
  if (!isNonEmptyString(question.instructions)) {
    throw invalidQuestion(
      `Question "${name}" needs non-empty instructions.`,
      `${at}.instructions`,
      operation,
    );
  }

  switch (question.type) {
    case "boolean":
      return;
    case "choice": {
      const options = question.options;
      if (!isPlainObject(options)) {
        throw invalidQuestion(
          `Choice question "${name}" needs an options object ({ value: description }).`,
          `${at}.options`,
          operation,
        );
      }
      const entries = Object.entries(options);
      if (entries.length < 1 || entries.length > MAX_CHOICE_OPTIONS) {
        throw invalidQuestion(
          `Choice question "${name}" needs 1 to ${MAX_CHOICE_OPTIONS} options, got ${entries.length}.`,
          `${at}.options`,
          operation,
        );
      }
      for (const [value, description] of entries) {
        if (value.length === 0 || typeof description !== "string") {
          throw invalidQuestion(
            `Choice question "${name}" has an invalid option "${value}": keys must be non-empty and descriptions must be strings.`,
            `${at}.options`,
            operation,
          );
        }
      }
      return;
    }
    case "score": {
      const levels = question.levels;
      if (
        !Array.isArray(levels) ||
        levels.length < MIN_SCORE_LEVELS ||
        levels.length > MAX_SCORE_LEVELS
      ) {
        throw invalidQuestion(
          `Score question "${name}" needs ${MIN_SCORE_LEVELS} to ${MAX_SCORE_LEVELS} levels.`,
          `${at}.levels`,
          operation,
        );
      }
      const labels = new Set<string>();
      for (const level of levels) {
        const label = typeof level === "string" ? level : level?.label;
        const description =
          typeof level === "string" ? undefined : level?.description;
        if (
          !isNonEmptyString(label) ||
          (description !== undefined && typeof description !== "string")
        ) {
          throw invalidQuestion(
            `Score question "${name}" has an invalid level: use a string or { label, description? }.`,
            `${at}.levels`,
            operation,
          );
        }
        // Answers key probabilities by label, so duplicates would collide.
        if (labels.has(label)) {
          throw invalidQuestion(
            `Score question "${name}" has the level "${label}" more than once.`,
            `${at}.levels`,
            operation,
          );
        }
        labels.add(label);
      }
      return;
    }
    default:
      throw invalidQuestion(
        `Question "${name}" has unknown type ${JSON.stringify(question.type)}. Use "boolean", "choice", or "score".`,
        `${at}.type`,
        operation,
      );
  }
}

/**
 * Throws configuration.incompatible_options for the first problem found, so a
 * bad question map fails before any request is sent.
 */
export function assertValidDecisionQuestions(
  questions: unknown,
  options: { maxQuestions: number; operation: string },
): asserts questions is DecisionQuestionMap {
  const { maxQuestions, operation } = options;
  if (!isPlainObject(questions)) {
    throw invalidQuestion(
      "questions must be an object keyed by question name.",
      "questions",
      operation,
    );
  }
  const names = Object.keys(questions);
  if (names.length < 1 || names.length > maxQuestions) {
    throw invalidQuestion(
      `Expected 1 to ${maxQuestions} questions, got ${names.length}.`,
      "questions",
      operation,
    );
  }
  for (const name of names) {
    if (!QUESTION_NAME_PATTERN.test(name)) {
      throw invalidQuestion(
        `Question name "${name}" must be 1 to 100 characters of letters, digits, "_", "." or "-".`,
        `questions.${name}`,
        operation,
      );
    }
    assertValidQuestion(name, questions[name], operation);
  }
}
