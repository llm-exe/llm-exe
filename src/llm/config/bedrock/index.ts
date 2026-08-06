import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";
import { anthropicPromptSanitize } from "../anthropic/promptSanitize";
import { effortTransform, topPTransform } from "../anthropic/effort";
import { anthropicFunctionCall, anthropicFunctions } from "../anthropic/mapOptions";
import { isImageUrlContentBlock } from "../_utils/imageContent";
import { LlmExeError } from "@/errors";
import { Config } from "@/types";
import { OutputAnthropicClaude3Chat } from "@/llm/output/claude";
import { OutputMetaLlama3Chat } from "@/llm/output/llama";
// import { amazonNovaPromptSanitize } from "./prompt.nova";

const ANTHROPIC_BEDROCK_VERSION = "bedrock-2023-05-31";

const amazonAnthropicChatV1: Config = {
  key: "amazon:anthropic.chat.v1",
  provider: "amazon:anthropic.chat",
  method: "POST",
  headers: `{"Content-Type": "application/json" }`,
  endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
  options: {
    prompt: {},
    topP: {},
    effort: {},
    maxTokens: {},
    awsRegion: {
      default: getEnvironmentVariable("AWS_REGION"),
      required: [true, "aws region is required"],
    },
    awsSecretKey: {},
    awsAccessKey: {},
  },
  mapBody: {
    prompt: {
      key: "messages",
      transform: (v: any, i: Record<string, any>, o: Record<string, any>) =>
        anthropicPromptSanitize(v, i, o, {
          provider: "amazon:anthropic.chat",
          // Bedrock's invoke API only accepts base64 image sources
          allowImageUrlSources: false,
        }),
    },
    topP: {
      key: "top_p",
      // Bedrock's Anthropic 4.7+/5 models 400 on non-default top_p, so drop it
      // for those (shared with the direct provider). The transform's additional
      // "drop top_p when temperature is also set on 4.x" rule is inert here,
      // since temperature is not a declared Bedrock option.
      transform: topPTransform,
    },
    maxTokens: {
      key: "max_tokens",
      default: 10000,
    },
    anthropic_version: {
      key: "anthropic_version",
      default: ANTHROPIC_BEDROCK_VERSION,
    },
    // effort maps to output_config.effort + thinking, shared with the direct
    // Anthropic provider (Bedrock's invoke API accepts the same top-level shape).
    // Placed after maxTokens so the #712 escalation floor sees the mapped
    // max_tokens value when it runs. See ../anthropic/effort.
    effort: {
      key: "output_config.effort",
      transform: effortTransform,
    },
  },
  mapOptions: {
    functionCall: anthropicFunctionCall,
    functions: anthropicFunctions,
  },
  transformResponse: OutputAnthropicClaude3Chat,
};

const amazonMetaChatV1: Config = {
  key: "amazon:meta.chat.v1",
  provider: "amazon:meta.chat",
  method: "POST",
  headers: `{"Content-Type": "application/json" }`,
  options: {
    prompt: {},
    topP: {},
    maxTokens: {},
    temperature: {},
    awsRegion: {
      default: getEnvironmentVariable("AWS_REGION"),
    },
    awsSecretKey: {},
    awsAccessKey: {},
  },
  endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
  mapBody: {
    prompt: {
      key: "prompt",
      transform: (messages: any) => {
        if (typeof messages === "string") {
          return messages;
        } else {
          const hasImageContent = messages.some(
            (message: any) =>
              Array.isArray(message?.content) &&
              message.content.some(isImageUrlContentBlock)
          );
          if (hasImageContent) {
            throw new LlmExeError("Image content is not supported", {
              code: "prompt.invalid_messages",
              context: {
                operation: "amazonMetaChatV1.prompt.transform",
                provider: "amazon:meta.chat",
                received: "a message with image content",
                expected: "text-only messages",
                resolution:
                  "This model accepts a flattened text prompt and cannot receive images.",
              },
            });
          }
          return replaceTemplateString(`{{>DialogueHistory key='messages'}}`, {
            messages,
          });
        }
      },
    },
    topP: {
      key: "top_p",
    },
    temperature: {
      key: "temperature",
    },
    maxTokens: {
      key: "max_gen_len",
      default: 2048,
    },
  },
  transformResponse: OutputMetaLlama3Chat,
};

// const amazonAmazonNovaChatV1: Config = {
//   key: "amazon:nova.chat.v1",
//   provider: "amazon:nova.chat",
//   method: "POST",
//   headers: `{"Content-Type": "application/json" }`,
//   endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
//   options: {
//     prompt: {},
//     topP: {},
//     maxTokens: {},
//     awsRegion: {
//       default: getEnvironmentVariable("AWS_REGION"),
//       required: [true, "aws region is required"],
//     },
//     awsSecretKey: {},
//     awsAccessKey: {},
//   },
//   mapBody: {
//     prompt: {
//       key: "messages",
//       transform: amazonNovaPromptSanitize,
//     },
//   },
// };

export const bedrock = {
  "amazon:anthropic.chat.v1": amazonAnthropicChatV1,
  "amazon:meta.chat.v1": amazonMetaChatV1,
  // "amazon:nova.chat.v1": amazonAmazonNovaChatV1,
};
