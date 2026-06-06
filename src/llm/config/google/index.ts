import { withDefaultModel } from "@/llm/_utils.withDefaultModel";
import { Config } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { googleGeminiPromptSanitize } from "./promptSanitize";
import { OutputGoogleGeminiChat } from "@/llm/output/google.gemini";
import { cleanJsonSchemaFor } from "@/llm/output/_utils/cleanJsonSchemaFor";

const googleGeminiChatV1: Config = {
  key: "google.chat.v1",
  provider: "google.chat",
  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent?key={{geminiApiKey}}`,
  options: {
    effort: {},
    prompt: {},
    // topP: {},
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
    effort: {
      key: "config.thinkingConfig.thinkingBudget",
      transform: (v, _s) => {
        if (
          // only supported reasoning models
          ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"].includes(
            _s.model
          ) &&
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
  "google.gemini-2.5-flash": withDefaultModel(
    googleGeminiChatV1,
    "gemini-2.5-flash"
  ),
  "google.gemini-2.5-flash-lite": withDefaultModel(
    googleGeminiChatV1,
    "gemini-2.5-flash-lite"
  ),
  "google.gemini-2.5-pro": withDefaultModel(
    googleGeminiChatV1,
    "gemini-2.5-pro"
  ),
  "google.gemini-3.1-flash-lite": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.1-flash-lite"
  ),
  "google.gemini-3.5-flash": withDefaultModel(
    googleGeminiChatV1,
    "gemini-3.5-flash"
  ),

  // Deprecated
  "google.gemini-2.0-flash": withDefaultModel(
    googleGeminiChatV1,
    "gemini-2.0-flash"
  ),
  "google.gemini-2.0-flash-lite": withDefaultModel(
    googleGeminiChatV1,
    "gemini-2.0-flash-lite"
  ),
  "google.gemini-1.5-pro": withDefaultModel(
    googleGeminiChatV1,
    "gemini-1.5-pro"
  ),
};
