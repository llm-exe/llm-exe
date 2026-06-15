import { apiRequest } from "@/utils/modules/request";
import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { getLlmConfig } from "@/llm/config";
import { mapBody } from "@/llm/_utils.mapBody";
import { parseHeaders } from "@/llm/_utils.parseHeaders";

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

  const response =
    config.provider === "openai.chat-mock"
      ? {
          data: {
            id: "0123-45-6789",
            model: "model",
            created: new Date().getTime(),
            usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
            choices: [
              {
                message: {
                  role: "assistant",
                  content: `Hello world from LLM! The input was ${JSON.stringify(
                    messages
                  )}`,
                },
              },
            ],
          },
          headers: {} as Record<string, string>,
        }
      : await apiRequest(url, {
          method: config.method,
          body: body,
          headers: headers,
        });

  const { transformResponse = OutputDefault } = config;
  const normalized = transformResponse(response.data, config, response.headers);
  return BaseLlmOutput(normalized);
}
