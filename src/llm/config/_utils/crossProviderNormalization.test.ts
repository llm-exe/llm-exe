import { openaiPromptMessageCallback } from "../openai/promptSanitizeMessageCallback";
import { anthropicPromptMessageCallback } from "../anthropic/promptSanitizeMessageCallback";
import { googleGeminiPromptMessageCallback } from "../google/promptSanitizeMessageCallback";

/**
 * Cross-provider normalization contract.
 *
 * llm-exe's core promise is that application code writes ONE message shape and
 * every provider receives its own native shape. These tests feed the exact same
 * llm-exe message to each provider callback and assert the provider-specific
 * output, so a change to one provider that silently diverges from the others
 * fails here rather than at runtime against a live API.
 */

const PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

describe("cross-provider message normalization contract", () => {
  describe("plain text user message", () => {
    const message = { role: "user", content: "Hello" } as any;

    it("openai keeps the message as-is", () => {
      expect(openaiPromptMessageCallback(message)).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("anthropic keeps the message as-is", () => {
      expect(anthropicPromptMessageCallback(message)).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("google converts string content into a text part", () => {
      expect(googleGeminiPromptMessageCallback(message)).toEqual({
        role: "user",
        parts: [{ text: "Hello" }],
      });
    });

    it("does not mutate the caller's message", () => {
      const original = { role: "user", content: "Hello" } as any;
      openaiPromptMessageCallback(original);
      anthropicPromptMessageCallback(original);
      googleGeminiPromptMessageCallback(original);
      expect(original).toEqual({ role: "user", content: "Hello" });
    });
  });

  describe("base64 image_url content block", () => {
    const message = {
      role: "user",
      content: [
        { type: "text", text: "What is this?" },
        { type: "image_url", image_url: { url: PNG_DATA_URI } },
      ],
    } as any;

    it("openai passes the image_url block through untouched", () => {
      expect(openaiPromptMessageCallback(message)).toEqual({
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image_url", image_url: { url: PNG_DATA_URI } },
        ],
      });
    });

    it("anthropic converts it to a base64 image source", () => {
      expect(anthropicPromptMessageCallback(message)).toEqual({
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBORw0KGgoAAAANSUhEUg==",
            },
          },
        ],
      });
    });

    it("google converts it to an inlineData part", () => {
      expect(googleGeminiPromptMessageCallback(message)).toEqual({
        role: "user",
        parts: [
          { text: "What is this?" },
          {
            inlineData: {
              mimeType: "image/png",
              data: "iVBORw0KGgoAAAANSUhEUg==",
            },
          },
        ],
      });
    });
  });

  describe("remote https image_url content block", () => {
    const url = "https://example.com/cat.png";
    const message = {
      role: "user",
      content: [{ type: "image_url", image_url: { url } }],
    } as any;

    it("openai passes the remote url through", () => {
      expect(openaiPromptMessageCallback(message)).toEqual({
        role: "user",
        content: [{ type: "image_url", image_url: { url } }],
      });
    });

    it("anthropic converts it to a url image source", () => {
      expect(anthropicPromptMessageCallback(message)).toEqual({
        role: "user",
        content: [{ type: "image", source: { type: "url", url } }],
      });
    });

    it("anthropic-on-bedrock rejects it, since bedrock cannot fetch remote images", () => {
      expect(() =>
        anthropicPromptMessageCallback(message, {
          provider: "amazon.chat",
          allowImageUrlSources: false,
        })
      ).toThrow("Image URLs are not supported by this provider");
    });

    it("google rejects arbitrary remote urls", () => {
      expect(() => googleGeminiPromptMessageCallback(message)).toThrow(
        "Gemini cannot load images from arbitrary URLs"
      );
    });

    it("google accepts a Files API uri", () => {
      const fileUri =
        "https://generativelanguage.googleapis.com/v1beta/files/abc123";
      expect(
        googleGeminiPromptMessageCallback({
          role: "user",
          content: [{ type: "image_url", image_url: { url: fileUri } }],
        } as any)
      ).toEqual({ role: "user", parts: [{ fileData: { fileUri } }] });
    });

    it("google accepts a gs:// uri", () => {
      const fileUri = "gs://my-bucket/cat.png";
      expect(
        googleGeminiPromptMessageCallback({
          role: "user",
          content: [{ type: "image_url", image_url: { url: fileUri } }],
        } as any)
      ).toEqual({ role: "user", parts: [{ fileData: { fileUri } }] });
    });
  });

  describe("assistant tool call", () => {
    const message = {
      role: "assistant",
      content: null,
      function_call: {
        id: "call_1",
        name: "get_weather",
        arguments: '{"city":"Denver"}',
      },
    } as any;

    it("openai emits a tool_calls array", () => {
      const result = openaiPromptMessageCallback(message);
      expect(result.role).toEqual("assistant");
      expect(result.function_call).toBeUndefined();
      expect(result.tool_calls).toEqual([
        {
          id: "call_1",
          type: "function",
          function: {
            name: "get_weather",
            arguments: '{"city":"Denver"}',
          },
        },
      ]);
    });

    it("anthropic emits a tool_use content block with parsed input", () => {
      const result = anthropicPromptMessageCallback(message);
      expect(result.role).toEqual("assistant");
      expect(result.function_call).toBeUndefined();
      expect(result.content).toEqual([
        {
          type: "tool_use",
          id: "call_1",
          name: "get_weather",
          input: { city: "Denver" },
        },
      ]);
    });

    it("google emits a functionCall part with the model role", () => {
      const result = googleGeminiPromptMessageCallback(message);
      expect(result.role).toEqual("model");
      expect(result.parts).toEqual([
        {
          functionCall: {
            name: "get_weather",
            args: { city: "Denver" },
          },
        },
      ]);
    });
  });

  describe("tool result message", () => {
    const message = {
      role: "function",
      id: "call_1",
      name: "get_weather",
      content: "72 and sunny",
    } as any;

    it("openai maps role function -> tool and id -> tool_call_id", () => {
      const result = openaiPromptMessageCallback(message);
      expect(result.role).toEqual("tool");
      expect(result.tool_call_id).toEqual("call_1");
      expect(result.id).toBeUndefined();
      expect(result.content).toEqual("72 and sunny");
    });

    it("anthropic maps role function -> user with a tool_result block", () => {
      const result = anthropicPromptMessageCallback(message);
      expect(result.role).toEqual("user");
      expect(result.id).toBeUndefined();
      expect(result.name).toBeUndefined();
      expect(result.content).toEqual([
        {
          type: "tool_result",
          tool_use_id: "call_1",
          content: "72 and sunny",
        },
      ]);
    });

    it("google maps role function -> user with a functionResponse part", () => {
      const result = googleGeminiPromptMessageCallback(message);
      expect(result.role).toEqual("user");
      expect(result.parts).toEqual([
        {
          functionResponse: {
            name: "get_weather",
            response: { result: "72 and sunny" },
          },
        },
      ]);
    });
  });

  describe("assistant role naming", () => {
    const message = { role: "assistant", content: "Sure thing" } as any;

    it("openai and anthropic keep the assistant role", () => {
      expect(openaiPromptMessageCallback(message).role).toEqual("assistant");
      expect(anthropicPromptMessageCallback(message).role).toEqual("assistant");
    });

    it("google renames assistant to model", () => {
      expect(googleGeminiPromptMessageCallback(message)).toEqual({
        role: "model",
        parts: [{ text: "Sure thing" }],
      });
    });
  });
});
