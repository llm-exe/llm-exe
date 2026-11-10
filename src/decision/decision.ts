import type {
  AllDecisionModels,
  DecisionModelKey,
  DecisionQuestionMap,
  DecisionRequest,
  DecisionResult,
} from "@/types";
import { apiRequestWrapper } from "@/utils/modules/requestWrapper";
import { getDecisionConfig } from "./config";
import { createDecision_call } from "./decision.call";
import { OPENAI_MAX_QUESTIONS } from "./openai";

/**
 * A decision model: takes an input plus typed questions and returns
 * probabilities, with no generated text. Pass it to createDecisionExecutor.
 *
 * @example
 * const model = useDecisionModel("openai.gpt-6-luna");
 */
export function useDecisionModel<K extends DecisionModelKey>(
  key: K,
  options?: AllDecisionModels[K]["input"],
) {
  const config = getDecisionConfig(key);
  const wrapper = apiRequestWrapper<
    DecisionResult<DecisionQuestionMap>,
    DecisionRequest
  >(config, { ...options }, createDecision_call);
  return {
    ...wrapper,
    key: config.key,
    /** Most questions this model accepts in one request. */
    maxQuestions: OPENAI_MAX_QUESTIONS,
  };
}

export type DecisionModel = ReturnType<typeof useDecisionModel>;
