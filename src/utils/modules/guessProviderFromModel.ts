import { LlmExeError } from "@/errors";

export function isModelKnownOpenAi(payload: { model: string }) {
  const model = payload.model.toLowerCase();
  if (model.startsWith("gpt-") || model.startsWith("chatgpt-")) {
    return true;
  }
  if (model === "o1" || model.startsWith("o1-")) {
    return true;
  }
  if (model === "o3-mini") {
    return true;
  }
  return false;
}

export function isModelKnownAnthropic(payload: { model: string }) {
  const model = payload.model.toLowerCase();
  if (model.startsWith("claude-")) {
    return true;
  }
  return false;
}

export function isModelKnownXai(payload: { model: string }) {
  const model = payload.model.toLowerCase();
  if (model.startsWith("grok-")) {
    return true;
  }
  return false;
}

export function isModelKnownBedrockAnthropic(payload: { model: string }) {
  const model = payload.model.toLowerCase();
  if (model.startsWith("anthropic.claude-")) {
    return true;
  }
  return false;
}

export function guessProviderFromModel(payload: { model: string }) {
  switch (true) {
    case isModelKnownOpenAi(payload):
      return "openai";
    case isModelKnownXai(payload):
      return "xai";
    case isModelKnownBedrockAnthropic(payload):
      return "bedrock:anthropic";
    case isModelKnownAnthropic(payload):
      return "anthropic";
    default:
      throw new LlmExeError("Unsupported model", {
        code: "configuration.invalid_provider",
        context: {
          operation: "guessProviderFromModel",
          model: payload.model,
          // Mirrors the switch above. Keep these in sync when adding a new
          // isModelKnown* case.
          availableProviders: [
            "openai",
            "xai",
            "bedrock:anthropic",
            "anthropic",
          ],
          resolution:
            "Pass a known model prefix (gpt-, chatgpt-, o1, o3-mini, claude-, grok-, anthropic.claude-) or specify the provider explicitly.",
        },
      });
  }
}
