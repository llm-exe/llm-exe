import { apiRequest } from "@/utils/modules/request";
import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { parseHeaders } from "@/llm/_utils.parseHeaders";
import { LlmExeError, isLlmExeError, statusToLlmProviderCode } from "@/errors";
import type {
  DecisionModelKey,
  DecisionQuestionMap,
  DecisionRequest,
  DecisionResult,
  LlmProvider,
} from "@/types";
import { getDecisionConfig } from "./config";
import { assertValidDecisionQuestions } from "./questions";
import {
  OPENAI_MAX_QUESTIONS,
  fromOpenAiDecisionResponse,
  toOpenAiDecisionBody,
} from "./openai";

export type DecisionCallState = Record<string, unknown> & {
  provider: LlmProvider;
  key: DecisionModelKey;
  model?: string;
};

export async function createDecision_call(
  state: DecisionCallState,
  request: DecisionRequest,
  _options?: unknown,
  signal?: AbortSignal,
): Promise<DecisionResult<DecisionQuestionMap>> {
  const config = getDecisionConfig(state.key);
  // Also checked when the executor is created. Checking again here covers
  // calling the model directly, and costs nothing next to the request.
  assertValidDecisionQuestions(request.questions, {
    maxQuestions: OPENAI_MAX_QUESTIONS,
    operation: "useDecisionModel_call",
  });

  const model = typeof state.model === "string" ? state.model : "";
  const body = JSON.stringify(toOpenAiDecisionBody(model, request));
  const url = replaceTemplateStringSimple(config.endpoint, state);
  const headers = await parseHeaders(config, state, {
    url,
    headers: {},
    body,
  });

  let data: unknown;
  try {
    const response = await apiRequest(url, {
      method: config.method,
      body,
      headers,
      ...(signal ? { signal } : {}),
    });
    data = response.data;
  } catch (e) {
    // apiRequest stays generic and throws request.http_error. Re-throw as the
    // matching llm.provider_* code so consumers can branch on err.code, and so
    // the request wrapper skips retries for deterministic failures (400, 401).
    if (!isLlmExeError(e, "request.http_error")) throw e;
    const ctx = (e.context ?? {}) as Record<string, unknown>;
    const status = typeof ctx.status === "number" ? ctx.status : undefined;
    throw new LlmExeError(e.message, {
      code: status
        ? statusToLlmProviderCode(status)
        : "llm.provider_http_error",
      context: {
        ...ctx,
        operation: "useDecisionModel_call",
        provider: state.provider,
        model,
      },
      cause: e,
    });
  }

  return fromOpenAiDecisionResponse(data, request.questions, {
    provider: state.provider,
    model,
  });
}
