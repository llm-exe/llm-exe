import { IChatMessage } from "@/types";
import { googleGeminiPromptMessageCallback } from "./promptSanitizeMessageCallback";

describe("googleGeminiPromptMessageCallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transforms 'assistant' role to 'model' and pushes string content into parts", () => {
    const message: IChatMessage = {
      role: "assistant",
      content: "Hello from assistant",
    };

    const result = googleGeminiPromptMessageCallback(message);

    expect(result).toEqual({
      role: "model",
      parts: [{ text: "Hello from assistant" }],
    });
  });

  it("transforms 'system' role to 'model' and pushes string content into parts", () => {
    const message: IChatMessage = {
      role: "system",
      content: "System message",
    };

    const result = googleGeminiPromptMessageCallback(message);

    expect(result).toEqual({
      role: "model",
      parts: [{ text: "System message" }],
    });
  });

  it("leaves role unchanged if it is neither 'assistant' nor 'system', and still pushes string content", () => {
    const message: IChatMessage = {
      role: "user",
      content: "User message",
    };

    const result = googleGeminiPromptMessageCallback(message);

    expect(result).toEqual({
      role: "user",
      parts: [{ text: "User message" }],
    });
  });

  it("returns empty parts if content is not a string", () => {
    const message: IChatMessage = {
      role: "assistant",
      content: { some: "object" } as any,
    };

    const result = googleGeminiPromptMessageCallback(message);

    expect(result).toEqual({
      role: "model",
      parts: [],
    });
  });

  it("returns empty parts if content is undefined", () => {
    const message: IChatMessage = {
      role: "assistant",
      content: undefined as any,
    };

    const result = googleGeminiPromptMessageCallback(message);

    expect(result).toEqual({
      role: "model",
      parts: [],
    });
  });

  describe("function role handling", () => {
    it("transforms 'function' role to 'user' and creates functionResponse part", () => {
      const message: IChatMessage = {
        role: "function",
        name: "testFunction",
        content: "Function result",
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "testFunction",
              response: {
                result: "Function result",
              },
            },
          },
        ],
      });
    });

    it("removes id field when role is function", () => {
      const message: IChatMessage = {
        role: "function",
        name: "testFunction",
        content: "Function result",
        id: "test-id",
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "testFunction",
              response: {
                result: "Function result",
              },
            },
          },
        ],
      });
      expect(result).not.toHaveProperty("id");
    });

    it("flattens a text-only block array into the response result", () => {
      const message: IChatMessage = {
        role: "function",
        name: "testFunction",
        content: [
          { type: "text", text: "line one" },
          { type: "text", text: "line two" },
        ],
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "testFunction",
              response: {
                result: "line one\nline two",
              },
            },
          },
        ],
      });
    });

    it("passes an arbitrary JSON array tool result into the Struct verbatim", () => {
      // Regression: functionResponse.response is an arbitrary Struct, so a JSON
      // array is valid (and idiomatic) structured tool output. Widening the
      // type for content blocks must not turn this into a thrown error.
      const message: IChatMessage = {
        role: "function",
        name: "search",
        content: [{ title: "a" }, { title: "b" }] as any,
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result.parts[0].functionResponse.response.result).toEqual([
        { title: "a" },
        { title: "b" },
      ]);
    });

    it("passes an empty array into the Struct verbatim", () => {
      const message: IChatMessage = {
        role: "function",
        name: "search",
        content: [] as any,
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result.parts[0].functionResponse.response.result).toEqual([]);
    });

    it("passes a mixed array through verbatim rather than flattening it", () => {
      // One entry has no `type`, so this is arbitrary JSON, not content blocks.
      const message: IChatMessage = {
        role: "function",
        name: "search",
        content: [{ type: "text", text: "a" }, { title: "b" }] as any,
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result.parts[0].functionResponse.response.result).toEqual([
        { type: "text", text: "a" },
        { title: "b" },
      ]);
    });

    it("throws when a tool result carries an image block", () => {
      const message: IChatMessage = {
        role: "function",
        name: "testFunction",
        content: [
          { type: "text", text: "here it is" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      };

      expect(() => googleGeminiPromptMessageCallback(message)).toThrow(
        "Image content is not supported in tool results by Gemini"
      );
    });

    it("throws on an unrecognized block inside a tool result", () => {
      const message: IChatMessage = {
        role: "function",
        name: "testFunction",
        content: [{ type: "audio" } as any],
      };

      expect(() => googleGeminiPromptMessageCallback(message)).toThrow(
        "Unsupported content block in tool result"
      );
    });
  });

  describe("function_call handling", () => {
    it("handles single function_call object", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Call a function",
        function_call: {
          name: "getWeather",
          arguments: JSON.stringify({ location: "Paris" }),
        },
      } as any;

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "model",
        parts: [
          { text: "Call a function" },
          {
            functionCall: {
              name: "getWeather",
              args: { location: "Paris" },
            },
          },
        ],
      });
    });

    it("handles array of function_call objects", () => {
      const message: IChatMessage = {
        role: "assistant",
        content: "Calling multiple functions",
        function_call: [
          {
            name: "getWeather",
            arguments: JSON.stringify({ location: "Paris" }),
          },
          {
            name: "getTime",
            arguments: JSON.stringify({ timezone: "UTC" }),
          },
        ],
      } as any;

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "model",
        parts: [
          { text: "Calling multiple functions" },
          {
            functionCall: {
              name: "getWeather",
              args: { location: "Paris" },
            },
          },
          {
            functionCall: {
              name: "getTime",
              args: { timezone: "UTC" },
            },
          },
        ],
      });
    });

    it("handles function_call with plain object arguments", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        function_call: {
          name: "testFunc",
          arguments: { already: "parsed" },
        },
      } as any;

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "model",
        parts: [
          { text: "Test" },
          {
            functionCall: {
              name: "testFunc",
              args: { already: "parsed" },
            },
          },
        ],
      });
    });

    it("sets role to model when function_call is present", () => {
      const message: IChatMessage = {
        role: "user",
        content: "",
        function_call: {
          name: "test",
          arguments: "{}",
        },
      } as any;

      const result = googleGeminiPromptMessageCallback(message);

      expect(result.role).toEqual("model");
    });

    it("removes function_call property from result", () => {
      const message: IChatMessage = {
        role: "user",
        content: "Test",
        function_call: {
          name: "test",
          arguments: "{}",
        },
      } as any;

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).not.toHaveProperty("function_call");
    });
  });

  describe("edge cases", () => {
    it("handles message with both function role and function_call", () => {
      const message: IChatMessage = {
        role: "function",
        name: "funcName",
        content: "result",
        function_call: {
          name: "anotherFunc",
          arguments: "{}",
        },
      } as any;

      const result = googleGeminiPromptMessageCallback(message);

      // function_call handling should override role to model
      expect(result).toEqual({
        role: "model",
        parts: [
          {
            functionResponse: {
              name: "funcName",
              response: {
                result: "result",
              },
            },
          },
          {
            functionCall: {
              name: "anotherFunc",
              args: {},
            },
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

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "model",
        parts: [{ text: "Test" }],
      });
    });
  });

  describe("array content handling", () => {
    it("converts text blocks to text parts", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [{ text: "Hello" }, { text: "World" }],
      });
    });

    it("converts a data: URI image block to an inlineData part", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [
          { text: "What is this?" },
          { inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } },
        ],
      });
    });

    it("converts Files API and gs:// URIs to fileData parts", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: "https://generativelanguage.googleapis.com/v1beta/files/abc123",
            },
          },
          {
            type: "image_url",
            image_url: { url: "gs://my-bucket/cat.png" },
          },
        ],
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [
          {
            fileData: {
              fileUri:
                "https://generativelanguage.googleapis.com/v1beta/files/abc123",
            },
          },
          { fileData: { fileUri: "gs://my-bucket/cat.png" } },
        ],
      });
    });

    it("throws for arbitrary https image URLs", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/cat.png" },
          },
        ],
      };

      expect(() => googleGeminiPromptMessageCallback(message)).toThrow(
        /Gemini cannot load images from arbitrary URLs/
      );
    });

    it("converts legacy blocks typed 'image' that carry image_url", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          {
            type: "image",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          } as any,
        ],
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } },
        ],
      });
    });

    it("passes unrecognized blocks through as native parts", () => {
      const message: IChatMessage = {
        role: "user",
        content: [
          { inlineData: { mimeType: "image/png", data: "abc" } } as any,
        ],
      };

      const result = googleGeminiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        parts: [{ inlineData: { mimeType: "image/png", data: "abc" } }],
      });
    });
  });
});
