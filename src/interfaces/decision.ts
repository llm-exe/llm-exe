import type { BaseLlmOptions } from "./llm";
import type { ObjectArray, PlainObject } from "./utils";

/** A yes/no question. The answer is the probability of "yes". */
export type DecisionBooleanQuestion = {
  type: "boolean";
  instructions: string;
};

/** Pick one option. Keys are the option values, values describe each one. */
export type DecisionChoiceQuestion = {
  type: "choice";
  instructions: string;
  options: Readonly<Record<string, string>>;
};

/** A score level: a label, or a label with a description of when it applies. */
export type DecisionScoreLevel =
  | string
  | { readonly label: string; readonly description?: string };

/** Rate on an ordered scale. Levels go from lowest to highest. */
export type DecisionScoreQuestion = {
  type: "score";
  instructions: string;
  levels: readonly DecisionScoreLevel[];
};

export type DecisionQuestion =
  | DecisionBooleanQuestion
  | DecisionChoiceQuestion
  | DecisionScoreQuestion;

/** Questions keyed by name. The name is how you read the answer back. */
export type DecisionQuestionMap = Readonly<Record<string, DecisionQuestion>>;

export type DecisionChoiceValue<Q extends DecisionChoiceQuestion> = Extract<
  keyof Q["options"],
  string
>;

type LevelLabel<L> = L extends string
  ? L
  : L extends { readonly label: infer T extends string }
    ? T
    : never;

export type DecisionScoreLabel<Q extends DecisionScoreQuestion> = LevelLabel<
  Q["levels"][number]
>;

export type DecisionBooleanAnswer = {
  type: "boolean";
  /** Probability that the answer is yes, from 0 to 1. */
  probability: number;
};

export type DecisionChoiceAnswer<V extends string = string> = {
  type: "choice";
  /** The most likely option. */
  choice: V;
  confidence: number;
  probabilities: Record<V, number>;
};

export type DecisionScoreAnswer<L extends string = string> = {
  type: "score";
  /**
   * Expected level index, from 0 (first level) to levels.length - 1. It can
   * be fractional: 2.99 means "almost certainly the fourth level".
   */
  score: number;
  /** The most likely level. */
  level: L;
  confidence: number;
  probabilities: Record<L, number>;
};

/** The model declined to answer this one question. Other answers still apply. */
export type DecisionRefusal = { type: "refusal" };

export type DecisionAnswer<Q extends DecisionQuestion> =
  | (Q extends DecisionChoiceQuestion
      ? DecisionChoiceAnswer<DecisionChoiceValue<Q>>
      : Q extends DecisionScoreQuestion
        ? DecisionScoreAnswer<DecisionScoreLabel<Q>>
        : DecisionBooleanAnswer)
  | DecisionRefusal;

export type DecisionUsage = {
  inputTokens: number;
  /** Not every provider reports output tokens. */
  outputTokens?: number;
};

export type DecisionResult<Q extends DecisionQuestionMap> = {
  model: string;
  answers: { [K in keyof Q]: DecisionAnswer<Q[K]> };
  usage: DecisionUsage;
};

/** What the questions are about: plain text, or a JSON object or array. */
export type DecisionInput = string | PlainObject | ObjectArray;

export type DecisionExecutorInput = { input: DecisionInput };

/** What the request wrapper hands to a provider call. */
export type DecisionRequest = {
  input: DecisionInput;
  questions: DecisionQuestionMap;
};

type DecisionRequestOptions = Pick<
  BaseLlmOptions,
  "traceId" | "timeout" | "maxDelay" | "numOfAttempts" | "jitter"
>;

export interface OpenAiDecisionModelOptions extends DecisionRequestOptions {
  model?: string;
  /** Defaults to the OPENAI_API_KEY environment variable. */
  openAiApiKey?: string;
  /** Defaults to https://api.openai.com/v1 */
  baseUrl?: string;
}

export interface TypeSafeDecisionModelOptions extends DecisionRequestOptions {
  model?: string;
  /** Defaults to the TYPESAFE_API_KEY environment variable. */
  typesafeApiKey?: string;
  /** Defaults to https://api.typesafe.ai/v1. Point it at a self-hosted System One server. */
  baseUrl?: string;
}

export interface CloudflareDecisionModelOptions extends DecisionRequestOptions {
  /** Defaults to the CLOUDFLARE_API_TOKEN environment variable. */
  cloudflareApiToken?: string;
  /** Defaults to the CLOUDFLARE_ACCOUNT_ID environment variable. */
  cloudflareAccountId?: string;
}

export type AllDecisionModels = {
  "openai.decisions.v1": {
    input: OpenAiDecisionModelOptions & { model: string };
  };
  "openai.gpt-6-luna": {
    input: Omit<OpenAiDecisionModelOptions, "model">;
  };
  "typesafe.systemone.v1": {
    input: TypeSafeDecisionModelOptions & { model: string };
  };
  "typesafe.jev": {
    input: Omit<TypeSafeDecisionModelOptions, "model">;
  };
  "cloudflare.clef": {
    input: CloudflareDecisionModelOptions;
  };
  "cloudflare.clef-flash": {
    input: CloudflareDecisionModelOptions;
  };
};

export type DecisionModelKey = keyof AllDecisionModels;
