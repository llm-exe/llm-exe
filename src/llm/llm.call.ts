import { apiRequest } from "@/utils/modules/request";
import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { getLlmConfig } from "@/llm/config";
import { mapBody } from "@/llm/_utils.mapBody";
import { parseHeaders } from "@/llm/_utils.parseHeaders";
import {
  LlmExeError,
  isLlmExeError,
  statusToLlmProviderCode,
} from "@/errors";

import {
  GenericFunctionCall,
  GenericLLm,
  IChatMessages,
  LlmProvider,
  LlmProviderKey,
  LlmExecutorWithFunctionsOptions,
} from "@/types";

import { OutputDefault } from "./output/default";
import { BaseLlmOutput } from "./output/base";
import { mapOptions } from "./_utils.mapOptions";

export async function useLlm_call(
  state: GenericLLm & { provider: LlmProvider; key: LlmProviderKey },
  messages: string | IChatMessages,
  _options?: LlmExecutorWithFunctionsOptions<GenericFunctionCall>
) {
  const config = getLlmConfig(state.key);

  const transformBody = mapBody(
    config.mapBody,
    Object.assign({}, state, {
      prompt: messages,
    })
  );

  const applyOptions = mapOptions(transformBody, _options, config);

  const body = JSON.stringify(applyOptions);

  const url = replaceTemplateStringSimple(config.endpoint, state);

  const headers = await parseHeaders(config, state, {
    url,
    headers: {},
    body: body,
  });

  const { transformResponse = OutputDefault } = config;

  if (config.provider === "openai.chat-mock") {
    const mockResponse = {
      id: "0123-45-6789",
      model: "model",
      created: new Date().getTime(),
      usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
      choices: [
        {
          message: {
            role: "assistant",
            content: `Hello world from LLM! The input was ${JSON.stringify(messages)}`,
          },
        },
      ],
    };
    return BaseLlmOutput(transformResponse(mockResponse, config, {}));
  }

  try {
    const response = await apiRequest(url, {
      method: config.method,
      body: body,
      headers: headers,
    });
    return BaseLlmOutput(
      transformResponse(response.data, config, response.headers)
    );
  } catch (e) {
    // apiRequest stays generic and throws request.http_error. Re-throw as the
    // matching llm.provider_* code so consumers can branch on err.code.
    // Anything else (including transformResponse errors) passes through.
    if (!isLlmExeError(e, "request.http_error")) throw e;
    const ctx = (e.context ?? {}) as Record<string, unknown>;
    const status = typeof ctx.status === "number" ? ctx.status : undefined;
    const code = status
      ? statusToLlmProviderCode(status)
      : "llm.provider_http_error";
    throw new LlmExeError(e.message, {
      code,
      context: {
        ...ctx,
        operation: "useLlm_call",
        provider: state.provider,
        model: state.model,
      },
      cause: e,
    });
  }
}
