import { openaiPromptMessageCallback } from "./promptSanitizeMessageCallback";

describe("openaiPromptMessageCallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("standard role handling", () => {
    it("returns message unchanged for standard roles", () => {
      const message = {
        role: "user",
        content: "Hello",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("returns message with assistant role unchanged", () => {
      const message = {
        role: "assistant",
        content: "Hi there",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Hi there",
      });
    });

    it("returns message with system role unchanged", () => {
      const message = {
        role: "system",
        content: "You are a helpful assistant",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "system",
        content: "You are a helpful assistant",
      });
    });
  });

  describe("function role handling", () => {
    it("transforms 'function' role to 'tool' with tool_call_id", () => {
      const message = {
        role: "function",
        id: "test-id-123",
        content: "Function executed successfully",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "tool",
        tool_call_id: "test-id-123",
        content: "Function executed successfully",
      });
    });

    it("removes id field when role is function", () => {
      const message = {
        role: "function",
        id: "test-id-456",
        content: "Result",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).not.toHaveProperty("id");
      expect(result).toHaveProperty("tool_call_id", "test-id-456");
    });

    it("handles function role without id", () => {
      const message = {
        role: "function",
        content: "No ID provided",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "tool",
        tool_call_id: undefined,
        content: "No ID provided",
      });
    });

    it("handles function role with extra properties", () => {
      const message = {
        role: "function",
        id: "func-id",
        content: "Result",
        name: "functionName",
        extraProp: "value",
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "tool",
        tool_call_id: "func-id",
        content: "Result",
        name: "functionName",
        extraProp: "value",
      });
    });
  });

  describe("function_call handling", () => {
    it("handles single function_call object", () => {
      const message = {
        role: "user",
        content: "Please get the weather",
        function_call: {
          id: "call-123",
          name: "getWeather",
          arguments: JSON.stringify({ location: "London" }),
        },
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Please get the weather",
        tool_calls: [
          {
            id: "call-123",
            type: "function",
            function: {
              name: "getWeather",
              arguments: JSON.stringify({ location: "London" }),
            },
          },
        ],
      });
    });

    it("handles array of function_call objects", () => {
      const message = {
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
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Getting multiple things",
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: {
              name: "getWeather",
              arguments: JSON.stringify({ location: "Paris" }),
            },
          },
          {
            id: "call-2",
            type: "function",
            function: {
              name: "getTime",
              arguments: JSON.stringify({ timezone: "UTC" }),
            },
          },
        ],
      });
    });

    it("sets role to assistant when function_call is present", () => {
      const message = {
        role: "user",
        content: "",
        function_call: {
          id: "test-id",
          name: "test",
          arguments: "{}",
        },
      };

      const result = openaiPromptMessageCallback(message);

      expect(result.role).toEqual("assistant");
    });

    it("removes function_call property from result", () => {
      const message = {
        role: "user",
        content: "Test",
        function_call: {
          id: "test-id",
          name: "test",
          arguments: "{}",
        },
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).not.toHaveProperty("function_call");
      expect(result).toHaveProperty("tool_calls");
    });

    it("handles function_call with additional properties", () => {
      const message = {
        role: "user",
        content: "Test",
        function_call: {
          id: "complex-id",
          name: "complexFunc",
          arguments: "{}",
          description: "A complex function",
          extra: "data",
        },
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Test",
        tool_calls: [
          {
            id: "complex-id",
            type: "function",
            function: {
              name: "complexFunc",
              arguments: "{}",
              description: "A complex function",
              extra: "data",
            },
          },
        ],
      });
    });
  });

  describe("edge cases", () => {
    it("handles message with both function role and function_call", () => {
      const message = {
        role: "function",
        id: "func-id",
        content: "result",
        function_call: {
          id: "call-id",
          name: "anotherFunc",
          arguments: "{}",
        },
      };

      const result = openaiPromptMessageCallback(message);

      // function_call handling should override and set role to assistant
      expect(result).toEqual({
        role: "assistant",
        tool_call_id: "func-id",
        content: "result",
        tool_calls: [
          {
            id: "call-id",
            type: "function",
            function: {
              name: "anotherFunc",
              arguments: "{}",
            },
          },
        ],
      });
    });

    it("handles empty function_call array", () => {
      const message = {
        role: "user",
        content: "Test",
        function_call: [],
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Test",
        tool_calls: [],
      });
    });

    it("preserves extra properties in the message", () => {
      const message = {
        role: "user",
        content: "Test",
        someExtraProp: "value",
        anotherProp: 123,
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: "Test",
        someExtraProp: "value",
        anotherProp: 123,
      });
    });

    it("handles function_call without id", () => {
      const message = {
        role: "user",
        content: "Test",
        function_call: {
          name: "noIdFunc",
          arguments: "{}",
        },
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "assistant",
        content: "Test",
        tool_calls: [
          {
            id: undefined,
            type: "function",
            function: {
              name: "noIdFunc",
              arguments: "{}",
            },
          },
        ],
      });
    });
  });

  describe("image content handling", () => {
    it("passes canonical image_url blocks through unchanged", () => {
      const message = {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/cat.png", detail: "low" },
          },
        ],
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual(message);
    });

    it("normalizes legacy blocks typed 'image' that carry image_url", () => {
      const message = {
        role: "user",
        content: [
          {
            type: "image",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      });
    });

    it("throws when a tool result carries an image block", () => {
      const message = {
        role: "function",
        id: "call_1",
        name: "get_snapshot",
        content: [
          { type: "text", text: "here it is" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      };

      expect(() => openaiPromptMessageCallback(message)).toThrow(
        "Image content is not supported in tool results by this provider"
      );
    });

    it("passes a text-only tool result block array through", () => {
      const message = {
        role: "function",
        id: "call_1",
        content: [{ type: "text", text: "72 and sunny" }],
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "tool",
        tool_call_id: "call_1",
        content: [{ type: "text", text: "72 and sunny" }],
      });
    });

    it("leaves non-image blocks in arrays untouched", () => {
      const message = {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      };

      const result = openaiPromptMessageCallback(message);

      expect(result).toEqual({
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      });
    });
  });
});