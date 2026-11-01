import { Config, GoogleGeminiResponse, OutputUsage } from "@/types";
import { formatOptions } from "../_util";
import { formatResult } from "./formatResult";

export function OutputGoogleGeminiChat(
  result: GoogleGeminiResponse,
  _config?: Config<any>
) {
  const id = result.responseId;
  const name =
    result.modelVersion || _config?.options.model?.default || "gemini";
  const created = new Date().getTime();

  const [_content, ..._options] = result?.candidates || [];
  const stopReason = _content?.finishReason?.toLowerCase();
  const content = formatResult(_content, id);
  const options = formatOptions(_options, formatResult);

  const cacheRead = result?.usageMetadata?.cachedContentTokenCount;
  const usage: OutputUsage = {
    output_tokens: result?.usageMetadata?.candidatesTokenCount,
    input_tokens: result?.usageMetadata?.promptTokenCount,
    total_tokens: result?.usageMetadata?.totalTokenCount,
    ...(cacheRead != null ? { cache_read_input_tokens: cacheRead } : {}),
  };

  return {
    id,
    name,
    created,
    usage,
    stopReason,
    content,
    options,
  };
}
