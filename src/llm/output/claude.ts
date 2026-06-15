import {
  Claude3Response,
  Config,
  OutputResultContent,
  OutputResultsFunction,
  OutputResultsText,
} from "@/types";
import { getBedrockTokenCounts } from "@/llm/output/_utils/getBedrockTokenCounts";

function formatResult(response: Claude3Response): OutputResultContent[] {
  const content = response?.content || [];
  const out = [];
  for (let i = 0; i < content.length; i++) {
    const result = content[i];
    if (result.type === "text") {
      out.push({
        type: "text",
        text: result.text,
      } as OutputResultsText);
    } else if (result.type === "tool_use") {
      out.push({
        functionId: result.id,
        type: "function_use",
        name: result.name,
        input: result.input,
      } as OutputResultsFunction);
    }
  }
  return out;
}

export function OutputAnthropicClaude3Chat(
  result: Claude3Response,
  _config?: Config<any>,
  headers?: Record<string, string>
) {
  const id = result.id;
  const name =
    result.model || _config?.options.model?.default || "anthropic.unknown";
  const stopReason = result.stop_reason;
  const content = formatResult(result);
  // Body usage is authoritative; Bedrock invoke responses also carry counts
  // in headers, which cover any body shape that omits usage.
  const headerUsage = getBedrockTokenCounts(headers);
  const input_tokens =
    result?.usage?.input_tokens ?? headerUsage?.input_tokens ?? 0;
  const output_tokens =
    result?.usage?.output_tokens ?? headerUsage?.output_tokens ?? 0;
  const usage = {
    input_tokens,
    output_tokens,
    total_tokens: input_tokens + output_tokens,
  };

  return {
    id,
    name,
    created: Date.now(),
    usage,
    stopReason,
    content,
  };
}
