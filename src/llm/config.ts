import { openai } from "./config/openai";
import { bedrock } from "./config/bedrock";
import { anthropic } from "./config/anthropic";
import { xai } from "./config/x";
import { ollama } from "./config/ollama";
import { google } from "./config/google";
import { deepseek } from "./config/deepseek";
import { LlmExeError } from "@/errors";

export const configs = {
  ...openai,
  ...anthropic,
  ...bedrock,
  ...xai,
  ...ollama,
  ...google,
  ...deepseek
};

export function getLlmConfig(provider: keyof typeof configs) {
  if (!provider) {
    throw new LlmExeError(`Missing provider`, {
      code: "configuration.missing_provider",
      context: {
        operation: "getLlmConfig",
        availableProviders: Object.keys(configs),
        resolution: "Provide a valid provider",
      },
    });
  }

  const pick = configs[provider];
  if (pick) {
    return pick;
  }

  throw new LlmExeError(`Invalid provider: ${provider}`, {
    code: "configuration.invalid_provider",
    context: {
      operation: "getLlmConfig",
      provider,
      availableProviders: Object.keys(configs),
      resolution: "Provide a valid provider",
    },
  });
}
