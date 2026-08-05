import { apiRequest } from "@/utils/modules/request";
import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { mapBody } from "@/llm/_utils.mapBody";
import { PROVIDED_OPTION_KEYS } from "@/llm/_utils.stateFromOptions";
import { parseHeaders } from "@/llm/_utils.parseHeaders";
import {
  LlmExeError,
  isLlmExeError,
  statusToEmbeddingProviderCode,
} from "@/errors";

import {
  GenericLLm,
  LlmProvider,
  EmbeddingInput,
  EmbeddingProviderKey,
  LlmExecutorWithFunctionsOptions,
} from "@/types";
import { getEmbeddingConfig } from "./config";
import { getEmbeddingOutputParser } from "./output/getEmbeddingOutputParser";

export async function createEmbedding_call(
  state: GenericLLm & {
    provider: Extract<LlmProvider, "openai.embedding">;
    key: EmbeddingProviderKey;
  },
  _input: EmbeddingInput,
  _options?: LlmExecutorWithFunctionsOptions
) {
  const config = getEmbeddingConfig(state.key);

  const input = mapBody(
    config.mapBody,
    Object.assign({}, state, {
      input: _input,
      // Carry option provenance onto the mapBody input so transforms can tell a
      // caller-set value from a defaulted one (issue #712). It is non-enumerable
      // on `state`, so Object.assign drops it; re-attach it explicitly. Keyed by
      // Symbol and never declared in config.mapBody, it is never mapped into the
      // outgoing request body.
      [PROVIDED_OPTION_KEYS]: (state as any)[PROVIDED_OPTION_KEYS],
    })
  );

  const body = JSON.stringify(input);

  const url = replaceTemplateStringSimple(config.endpoint, state);

  const headers = await parseHeaders(config, state, {
    url,
    headers: {},
    body: body,
  });

  try {
    const request = await apiRequest(url, {
      method: config.method,
      body: body,
      headers: headers,
    });
    return getEmbeddingOutputParser(state, request.data, request.headers);
  } catch (e) {
    // apiRequest stays generic and throws request.http_error. Re-throw as the
    // matching embedding.provider_* code so consumers can branch on err.code.
    // Anything else (including getEmbeddingOutputParser errors) passes through.
    if (!isLlmExeError(e, "request.http_error")) throw e;
    const ctx = (e.context ?? {}) as Record<string, unknown>;
    const status = typeof ctx.status === "number" ? ctx.status : undefined;
    const code = status
      ? statusToEmbeddingProviderCode(status)
      : "embedding.provider_http_error";
    throw new LlmExeError(e.message, {
      code,
      context: {
        ...ctx,
        operation: "createEmbedding_call",
        provider: state.provider,
        model: state.model,
      },
      cause: e,
    });
  }
}
