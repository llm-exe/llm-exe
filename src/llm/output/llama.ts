import { Config, MetaLlama2Response, OutputResultsText } from "@/types";
import { uuid } from "@/utils/modules/uuid";
import { getBedrockTokenCounts } from "@/llm/output/_utils/getBedrockTokenCounts";

export function OutputMetaLlama3Chat(
  result: MetaLlama2Response,
  _config?: Config<any>,
  headers?: Record<string, string>
) {
  const id = uuid();
  const name = _config?.options?.model?.default || "meta";
  const created = new Date().getTime();
  const stopReason = result.stop_reason;

  const content: OutputResultsText[] = [
    { type: "text", text: result.generation },
  ];

  // Body usage is authoritative; Bedrock invoke responses also carry counts
  // in headers, which cover any body shape that omits usage.
  const headerUsage = getBedrockTokenCounts(headers);
  const output_tokens =
    result?.generation_token_count ?? headerUsage?.output_tokens ?? 0;
  const input_tokens =
    result?.prompt_token_count ?? headerUsage?.input_tokens ?? 0;
  const usage = {
    output_tokens,
    input_tokens,
    total_tokens: output_tokens + input_tokens,
  };

  return {
    id,
    name,
    created,
    usage,
    stopReason,
    content,
    options: [],
  };
}
