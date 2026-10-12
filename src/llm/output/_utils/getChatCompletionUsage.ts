import { OutputUsage } from "@/types";

interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
    cache_write_tokens?: number | null;
  } | null;
  prompt_cache_hit_tokens?: number | null;
}

/** OpenAI-compatible totals already include cached input. */
export function getChatCompletionUsage(
  usage: ChatCompletionUsage,
): OutputUsage {
  const cacheRead =
    usage?.prompt_cache_hit_tokens ??
    usage?.prompt_tokens_details?.cached_tokens;
  const cacheWrite = usage?.prompt_tokens_details?.cache_write_tokens;
  return {
    input_tokens: usage?.prompt_tokens,
    output_tokens: usage?.completion_tokens,
    total_tokens: usage?.total_tokens,
    ...(cacheRead != null ? { cache_read_input_tokens: cacheRead } : {}),
    ...(cacheWrite != null ? { cache_creation_input_tokens: cacheWrite } : {}),
  };
}
