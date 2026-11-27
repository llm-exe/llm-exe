import { combineJsonl } from "./_utils/combineJsonl";
import { Config, OllamaResponse } from "@/types";

export function OutputOllamaChat(result: string, _config?: Config<any>) {
  const combined = combineJsonl<OllamaResponse>(result);

  const name =
    combined.result.model ||
    _config?.options.model?.default ||
    "ollama.unknown";
  const timestamp = combined.result.created_at;
  const providerTime = Date.parse(timestamp ?? "");
  const hasProviderTime = Number.isFinite(providerTime);
  const created = hasProviderTime ? providerTime : Date.now();
  const id = `${name}.${hasProviderTime ? timestamp : new Date(created).toISOString()}`;

  const stopReason = `${combined?.result?.done_reason || "stop"}`;
  const content = [combined.content];

  const inputTokens = combined.result.prompt_eval_count ?? 0;
  const outputTokens = combined.result.eval_count ?? 0;
  const usage = {
    output_tokens: outputTokens,
    input_tokens: inputTokens,
    total_tokens: inputTokens + outputTokens,
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
