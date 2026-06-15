import { googleGeminiPromptSanitize } from "./promptSanitize";
import { googleGeminiPromptMessageCallback } from "./promptSanitizeMessageCallback";
import { LlmExeError } from "@/errors";

jest.mock("./promptSanitizeMessageCallback", () => ({
  googleGeminiPromptMessageCallback: jest.fn(),
}));

describe("googleGeminiPromptSanitize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw error if input is not a string or array", () => {
    expect(() => googleGeminiPromptSanitize(
      { someWrongObject: "value" } as any,
      { someInput: "value" },
      { someOutput: "value" }
    )).toThrowError("Invalid messages format");
  });


  it("should return the string directly if _messages is a string", () => {
    const result = googleGeminiPromptSanitize(
      "Hello world",
      { someInput: "value" },
      { someOutput: "value" }
    );
    expect(result).toEqual( [{ role: "user", parts: [{ text: "Hello world" }] }]);
    expect(googleGeminiPromptMessageCallback).not.toHaveBeenCalled();
  });

  it("should throw an error if _messages is an empty array", () => {
    expect(() =>
      googleGeminiPromptSanitize([], {}, {})
    ).toThrowError("Empty messages array");
    expect(googleGeminiPromptMessageCallback).not.toHaveBeenCalled();
  });

  it("throws LlmExeError with prompt.invalid_messages on empty messages array", () => {
    try {
      googleGeminiPromptSanitize([], {}, {});
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("prompt.invalid_messages");
      expect((e as LlmExeError).category).toBe("prompt");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("googleGeminiPromptSanitize");
      expect(ctx.provider).toBe("google");
    }
  });

  it("throws LlmExeError with prompt.invalid_messages on non-string/array input", () => {
    try {
      googleGeminiPromptSanitize(
        { someWrongObject: "value" } as any,
        {},
        {}
      );
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("prompt.invalid_messages");
      expect((e as LlmExeError).category).toBe("prompt");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("googleGeminiPromptSanitize");
      expect(ctx.provider).toBe("google");
      expect(ctx.received).toBe("object");
    }
  });

  it("should return the single user message if provided a single system message", () => {
    const result = googleGeminiPromptSanitize(
      [{ role: "system", content: "Hello World" }],
      { someInput: "value" },
      { someOutput: "value" }
    );
    expect(result).toEqual([
      { role: "user", parts: [{ text: "Hello World" }] }
    ]);
    expect(googleGeminiPromptMessageCallback).not.toHaveBeenCalled();
  });

  it("should return the single user message and system message moved to system message input", () => {
    const out = {};
    googleGeminiPromptSanitize(
      [{ role: "system", content: "Hello World", }, { role: "user", content: "User message" }],
      { someInput: "value" },
      out
    );

    expect((out as any).system_instruction).toEqual(
      { parts: [{ text: "Hello World" }] }
    );
    expect(googleGeminiPromptMessageCallback).toHaveBeenCalledTimes(1);
  });

  it("should map the array of messages using googleGeminiPromptMessageCallback if _messages is a non-empty array", () => {
    (googleGeminiPromptMessageCallback as jest.Mock).mockImplementation(
      (msg) => ({ ...msg, processed: true })
    );
    const mockArray = [{ text: "msg1" }, { text: "msg2" }] as any;
    const result = googleGeminiPromptSanitize(mockArray, {}, {});

    expect(googleGeminiPromptMessageCallback).toHaveBeenCalledTimes(2);
    expect(googleGeminiPromptMessageCallback).toHaveBeenCalledWith(
      mockArray[0], 0, mockArray
    );
    expect(googleGeminiPromptMessageCallback).toHaveBeenCalledWith(
      mockArray[1], 1, mockArray
    );
    expect(result).toEqual([
      { text: "msg1", processed: true },
      { text: "msg2", processed: true },
    ]);
  });

  describe("mergeConsecutiveSameRole", () => {
    it("should merge consecutive messages with same role and array parts", () => {
      (googleGeminiPromptMessageCallback as jest.Mock).mockImplementation(
        (msg) => ({
          role: msg.role || "model",
          parts: [{ text: msg.content || msg.text || "" }],
        })
      );

      const messages = [
        { role: "user", content: "msg1" },
        { role: "user", content: "msg2" },
      ] as any;

      const result = googleGeminiPromptSanitize(messages, {}, {});

      // Consecutive user messages with array parts should be merged
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      expect(result[0].parts).toHaveLength(2);
    });

    it("should not merge consecutive messages with different roles", () => {
      (googleGeminiPromptMessageCallback as jest.Mock).mockImplementation(
        (msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: [{ text: msg.content }],
        })
      );

      const messages = [
        { role: "user", content: "question" },
        { role: "assistant", content: "answer" },
      ] as any;

      const result = googleGeminiPromptSanitize(messages, {}, {});

      expect(result).toHaveLength(2);
    });

    it("should merge consecutive model messages with parts for tool calls", () => {
      (googleGeminiPromptMessageCallback as jest.Mock).mockImplementation(
        (msg) => ({
          role: "model",
          parts: [{ functionCall: { name: msg.name || "fn", args: {} } }],
        })
      );

      const messages = [
        { role: "assistant", content: "call1" },
        { role: "assistant", content: "call2" },
      ] as any;

      const result = googleGeminiPromptSanitize(messages, {}, {});

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("model");
      expect(result[0].parts).toHaveLength(2);
    });

    it("should handle system messages with merge in remaining messages", () => {
      (googleGeminiPromptMessageCallback as jest.Mock).mockImplementation(
        (msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: [{ text: msg.content }],
        })
      );

      const out: Record<string, any> = {};
      const messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "msg1" },
        { role: "user", content: "msg2" },
      ] as any;

      const result = googleGeminiPromptSanitize(messages, {}, out);

      expect(out.system_instruction).toEqual({
        parts: [{ text: "System prompt" }],
      });
      // The two consecutive user messages should be merged
      expect(result).toHaveLength(1);
      expect(result[0].parts).toHaveLength(2);
    });

    it("should handle multiple system messages", () => {
      (googleGeminiPromptMessageCallback as jest.Mock).mockImplementation(
        (msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: [{ text: msg.content }],
        })
      );

      const out: Record<string, any> = {};
      const messages = [
        { role: "system", content: "System 1" },
        { role: "system", content: "System 2" },
        { role: "user", content: "Hello" },
      ] as any;

      const result = googleGeminiPromptSanitize(messages, {}, out);

      expect(out.system_instruction).toEqual({
        parts: [{ text: "System 1" }, { text: "System 2" }],
      });
      expect(result).toHaveLength(1);
    });
  });
});