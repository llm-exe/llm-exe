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

  const usage = {
    output_tokens: 0,
    input_tokens: 0,
    total_tokens: 0,
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
