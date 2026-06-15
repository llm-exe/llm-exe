/**
 * Token counts from Bedrock's invoke response headers
 * (X-Amzn-Bedrock-Input-Token-Count / X-Amzn-Bedrock-Output-Token-Count).
 * Some Bedrock models (Cohere embed) return usage only in headers; others
 * (Anthropic, Meta) carry it in the body, making this the fallback.
 * Returns undefined when neither header is present (non-Bedrock responses).
 */
export function getBedrockTokenCounts(
  headers: Record<string, string> | undefined
): { input_tokens: number; output_tokens: number } | undefined {
  if (!headers) return undefined;
  const input = parseInt(headers["x-amzn-bedrock-input-token-count"], 10);
  const output = parseInt(headers["x-amzn-bedrock-output-token-count"], 10);
  if (!Number.isFinite(input) && !Number.isFinite(output)) {
    return undefined;
  }
  return {
    input_tokens: Number.isFinite(input) ? input : 0,
    output_tokens: Number.isFinite(output) ? output : 0,
  };
}
