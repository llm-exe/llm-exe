import { apiRequest } from "@/utils/modules/request";
import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { mapBody } from "@/llm/_utils.mapBody";
import { parseHeaders } from "@/llm/_utils.parseHeaders";

import {
  GenericLLm,
  LlmProvider,
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
  _input: string | string[],
  _options?: LlmExecutorWithFunctionsOptions
) {
  const config = getEmbeddingConfig(state.key);

  const input = mapBody(
    config.mapBody,
    Object.assign({}, state, {
      input: _input,
    })
  );

  const body = JSON.stringify(input);

  const url = replaceTemplateStringSimple(config.endpoint, state);

  const headers = await parseHeaders(config, state, {
    url,
    headers: {},
    body: body,
  });

  const request = await apiRequest(url, {
    method: config.method,
    body: body,
    headers: headers,
  });

  return getEmbeddingOutputParser(state, request.data, request.headers);
}
