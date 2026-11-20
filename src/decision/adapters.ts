import type {
  DecisionQuestionMap,
  DecisionRequest,
  DecisionResult,
  LlmProvider,
} from "@/types";
import { LlmExeError } from "@/errors";
import { fromOpenAiDecisionResponse, toOpenAiDecisionBody } from "./openai";
import { fromSystemOneResponse, toSystemOneBody } from "./systemone";

/** How one provider's decision API is spoken. */
export type DecisionAdapter = {
  /** Most questions the provider accepts in one request. */
  maxQuestions: number;
  toBody: (model: string, request: DecisionRequest) => unknown;
  fromResponse: (
    raw: unknown,
    questions: DecisionQuestionMap,
    provider: { provider: string; model: string },
  ) => DecisionResult<DecisionQuestionMap>;
};

const systemOne = {
  toBody: toSystemOneBody,
  fromResponse: fromSystemOneResponse,
};

const decisionAdapters: Partial<Record<LlmProvider, DecisionAdapter>> = {
  "openai.decisions": {
    maxQuestions: 400,
    toBody: toOpenAiDecisionBody,
    fromResponse: fromOpenAiDecisionResponse,
  },
  // TypeSafe documents no question limit. 400 matches OpenAI, the highest
  // documented limit, so a map that works here works there too.
  "typesafe.systemone": { maxQuestions: 400, ...systemOne },
  "cloudflare.clef": { maxQuestions: 64, ...systemOne },
};

export function getDecisionAdapter(provider: LlmProvider): DecisionAdapter {
  const adapter = decisionAdapters[provider];
  if (!adapter) {
    throw new LlmExeError(`No decision adapter for provider: ${provider}`, {
      code: "configuration.invalid_provider",
      context: {
        operation: "getDecisionAdapter",
        provider,
        availableProviders: Object.keys(decisionAdapters),
      },
    });
  }
  return adapter;
}
