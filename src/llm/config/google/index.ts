import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { deprecateShorthand } from "@/llm/_utils.deprecationWarning";
import { Config } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { googleGeminiPromptSanitize } from "./promptSanitize";
import { OutputGoogleGeminiChat } from "@/llm/output/google.gemini";
import { cleanJsonSchemaFor } from "@/llm/output/_utils/cleanJsonSchemaFor";

/**
 * Gemini exposes `thinkingConfig.thinkingBudget` on every thinking-capable
 * model from 2.5 onward. Matching on the version rather than a literal list of
 * model ids keeps `effort` working as new models ship — pre-2.5 models (1.5,
 * 2.0) have no thinking budget, so they still drop the option.
 */
function supportsThinkingBudget(model: unknown) {
  if (typeof model !== "string") return false;
  const version = /^gemini-(\d+)\.(\d+)(?:-|$)/.exec(model);
  if (!version) return false;
  const major = Number(version[1]);
  const minor = Number(version[2]);
  return major > 2 || (major === 2 && minor >= 5);
}

const googleGeminiChatV1: Config = {
  key: "google.chat.v1",
  provider: "google.chat",
  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent?key={{geminiApiKey}}`,
  options: {
    effort: {},
    prompt: {},
    temperature: {},
    topP: {},
    maxTokens: {},
    stopSequences: {},
    geminiApiKey: {
      default: getEnvironmentVariable("GEMINI_API_KEY"),
    },
  },
  method: "POST",
  headers: `{"Content-Type": "application/json" }`,
  mapBody: {
    prompt: {
      key: "contents",
      transform: googleGeminiPromptSanitize,
    },
    temperature: {
      key: "generationConfig.temperature",
    },
    topP: {
      key: "generationConfig.topP",
    },
    maxTokens: {
      key: "generationConfig.maxOutputTokens",
    },
    stopSequences: {
      key: "generationConfig.stopSequences",
    },
    effort: {
      key: "config.thinkingConfig.thinkingBudget",
      transform: (v, _s) => {
        if (
          supportsThinkingBudget(_s.model) &&
          typeof v === "string" &&
          ["minimal", "low", "medium", "high"].includes(v)
        ) {
          if (v === "low" || v === "minimal") {
            return 1024;
          } else if (v === "medium") {
            return 8192;
          } else if (v === "high") {
            return 24576;
          }
        }
        return undefined;
      },
    },
  },
  mapOptions: {
    functionCall: (call) => ({
      toolConfig: {
        functionCallingConfig: {
          mode: call === "any" ? "any" : call === "none" ? "none" : "auto",
        },
      },
    }),

    functions: (functions) => ({
      tools: [
        {
          functionDeclarations: functions.map((f) => ({
            name: f.name,
            description: f.description,
            parameters: cleanJsonSchemaFor(f.parameters, "google.chat"),
          })),
        },
      ],
    }),
  },
  transformResponse: OutputGoogleGeminiChat,
};

export const google = {
  "google.chat.v1": googleGeminiChatV1,

  "google.gemini-3.1-flash-lite": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.1-flash-lite"
  ),
  "google.gemini-3.5-flash": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.5-flash"
  ),
  "google.gemini-3.5-flash-lite": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.5-flash-lite"
  ),
  "google.gemini-3.6-flash": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.6-flash"
  ),
  "google.gemini-3.7-flash": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.7-flash"
  ),

  // Deprecated
  ...deprecateShorthand("google.gemini-2.5-flash", {
    config: withDefaultModel(googleGeminiChatV1, "gemini-2.5-flash"),
    message:
      'Model "google.gemini-2.5-flash" is deprecated and will shut down on 2026-06-17.',
  }),
  ...deprecateShorthand("google.gemini-2.5-flash-lite", {
    config: withDefaultModel(googleGeminiChatV1, "gemini-2.5-flash-lite"),
    message:
      'Model "google.gemini-2.5-flash-lite" is deprecated and will shut down on 2026-07-22.',
  }),
  ...deprecateShorthand("google.gemini-2.5-pro", {
    config: withDefaultModel(googleGeminiChatV1, "gemini-2.5-pro"),
    message:
      'Model "google.gemini-2.5-pro" is deprecated and will shut down on 2026-06-17.',
  }),
  // Shut down by Google — kept only so existing code warns instead of
  // failing silently. Slated for removal in the next major release.
  ...deprecateShorthand("google.gemini-2.0-flash", {
    config: withDefaultModel(googleGeminiChatV1, "gemini-2.0-flash"),
    message:
      'Model "google.gemini-2.0-flash" was shut down by Google on 2026-06-01 and will fail at the API. Migrate to "google.gemini-3.5-flash".',
  }),
  ...deprecateShorthand("google.gemini-2.0-flash-lite", {
    config: withDefaultModel(googleGeminiChatV1, "gemini-2.0-flash-lite"),
    message:
      'Model "google.gemini-2.0-flash-lite" was shut down by Google on 2026-06-01 and will fail at the API. Migrate to "google.gemini-3.1-flash-lite".',
  }),
  ...deprecateShorthand("google.gemini-1.5-pro", {
    config: withDefaultModel(googleGeminiChatV1, "gemini-1.5-pro"),
    message:
      'Model "google.gemini-1.5-pro" was shut down by Google on 2025-09-29 and will fail at the API. Migrate to "google.gemini-3.5-flash".',
  }),
};
