import { IChatMessage } from "@/interfaces";
import { anthropicPromptMessageCallback } from "./promptSanitizeMessageCallback";

describe("anthropicPromptMessageCallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("standard role handling", () => {
    it("returns message unchanged for standard roles", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Hello",
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("returns message with assistant role unchanged", () => {
      const message: IChatMessage = {
        role: "assistant",
        content: "Hi there",
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Hi there",
      });
    });
  });

  describe("function role handling", () => {
    it("transforms 'function' role to 'user' with tool_result content", () => {
      const message: IChatMessage = {
        role: "function",
        id: "test-id-123",
        name: "test_function",
        content: "Function executed successfully",
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "test-id-123",
            content: "Function executed successfully",
          },
        ],
      });
    });

    it("removes id field when role is function", () => {
      const message: IChatMessage = {
        role: "function",
        id: "test-id-456",
        name: "test_function",
        content: "Result",
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).not.toHaveProperty("id");
      expect(result.role).toBe("user");
    });

    it("handles function role with complex content", () => {
      const message: IChatMessage = {
        role: "function",
        id: "complex-id",
        name: "complex_function",
        // @ts-expect-error Testing object content - function role should have string content
        content: { data: "structured", result: true },
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "complex-id",
            content: '{"data":"structured","result":true}',
          },
        ],
      });
    });

    it("deletes name property when handling function role", () => {
      const message: IChatMessage = {
        role: "function",
        id: "test-id",
        name: "functionName",
        content: "test content",
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).not.toHaveProperty("name");
      expect(result).not.toHaveProperty("id");
      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "test-id",
            content: "test content",
          },
        ],
      });
    });
  });

  describe("function_call handling", () => {
    it("handles single function_call object", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Please get the weather",
        function_call: {
          id: "call-123",
          name: "getWeather",
          arguments: JSON.stringify({ location: "London" }),
        },
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call-123",
            name: "getWeather",
            input: { location: "London" },
          },
        ],
      });
    });

    it("handles array of function_call objects", () => {
      const message: IChatMessage = {
        role: "assistant",
        content: "Getting multiple things",
        function_call: [
          {
            id: "call-1",
            name: "getWeather",
            arguments: JSON.stringify({ location: "Paris" }),
          },
          {
            id: "call-2",
            name: "getTime",
            arguments: JSON.stringify({ timezone: "UTC" }),
          },
        ],
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call-1",
            name: "getWeather",
            input: { location: "Paris" },
          },
          {
            type: "tool_use",
            id: "call-2",
            name: "getTime",
            input: { timezone: "UTC" },
          },
        ],
      });
    });

    it("handles function_call with plain object arguments", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        function_call: {
          id: "obj-call",
          name: "testFunc",
          arguments: { already: "parsed", value: 42 },
        },
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "obj-call",
            name: "testFunc",
            input: { already: "parsed", value: 42 },
          },
        ],
      });
    });

    it("sets role to assistant when function_call is present", () => {
      const message: IChatMessage = {
        role: "user",
        content: "",
        function_call: {
          id: "test-id",
          name: "test",
          arguments: "{}",
        },
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result.role).toEqual("assistant");
    });

    it("removes function_call property from result", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        function_call: {
          id: "test-id",
          name: "test",
          arguments: "{}",
        },
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).not.toHaveProperty("function_call");
    });

    it("handles function_call with invalid JSON in arguments", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        function_call: {
          id: "invalid-json",
          name: "testFunc",
          arguments: "not valid json",
        },
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "invalid-json",
            name: "testFunc",
            input: {}, // maybeParseJSON returns empty object if parse fails
          },
        ],
      });
    });
  });

  describe("edge cases", () => {
    it("handles message with both function role and function_call", () => {
      const message: IChatMessage = {
        role: "function",
        id: "func-id",
        name: "test_function",
        content: "result",
        function_call: {
          id: "call-id",
          name: "anotherFunc",
          arguments: "{}",
        },
      } as any;

      const result = anthropicPromptMessageCallback(message);

      // function_call handling should override and set role to assistant
      expect(result).toEqual({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "call-id",
            name: "anotherFunc",
            input: {},
          },
        ],
      });
    });

    it("handles empty function_call array", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        function_call: [],
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: [],
      });
    });

    it("preserves extra properties in the message", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        someExtraProp: "value",
      } as any;

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: "Test",
        someExtraProp: "value",
      });
    });

    it("handles function role without id", () => {
      const message: IChatMessage = {
        role: "function",
        name: "test_function",
        content: "No ID provided",
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: undefined,
            content: "No ID provided",
          },
        ],
      });
    });
  });

  describe("image content handling", () => {
    it("converts a data: URI image block to an anthropic base64 source", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBORw0KGgo=",
            },
          },
        ],
      });
    });

    it("converts an https image block to an anthropic url source", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/cat.png" },
          },
        ],
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: "https://example.com/cat.png" },
          },
        ],
      });
    });

    it("converts legacy blocks typed 'image' that carry image_url", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image",
            image_url: { url: "https://example.com/cat.png" },
          } as any,
        ],
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "url", url: "https://example.com/cat.png" },
          },
        ],
      });
    });

    it("leaves text blocks and unknown blocks untouched", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          { type: "tool_result", tool_use_id: "abc", content: "ok" } as any,
        ],
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          { type: "tool_result", tool_use_id: "abc", content: "ok" },
        ],
      });
    });

    it("handles mixed text and image content", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "Describe:" },
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,/9j/4AAQ" },
          },
        ],
      };

      const result = anthropicPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          { type: "text", text: "Describe:" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: "/9j/4AAQ",
            },
          },
        ],
      });
    });

    it("throws for url images when allowImageUrlSources is false", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/cat.png" },
          },
        ],
      };

      expect(() =>
        anthropicPromptMessageCallback(message, {
          provider: "amazon:anthropic.chat",
          allowImageUrlSources: false,
        })
      ).toThrow(/Image URLs are not supported/);
    });

    it("still allows base64 images when allowImageUrlSources is false", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      };

      const result = anthropicPromptMessageCallback(message, {
        provider: "amazon:anthropic.chat",
        allowImageUrlSources: false,
      });

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBORw0KGgo=",
            },
          },
        ],
      });
    });

    it("throws on a malformed data: URI", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "data:image/png,raw" } },
        ],
      };

      expect(() => anthropicPromptMessageCallback(message)).toThrow(
        /Malformed data: URI/
      );
    });
  });
});