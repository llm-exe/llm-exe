import { IChatMessages } from "@/interfaces";
import { anthropicPromptSanitize } from "./promptSanitize";

describe("anthropicPromptSanitize", () => {
  it("should handle string messages", () => {
    const result = anthropicPromptSanitize("Hello, World!", {}, {});
    expect(result).toEqual([{ role: "user", content: "Hello, World!" }]);
  });

  it("should handle IChatMessages with single system message first", () => {
    const messages: IChatMessages = [
      { role: "system", content: "Hello, World!" },
    ];
    const outputObj: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, {}, outputObj);

    expect(outputObj).toEqual({});
    expect(result).toEqual([{ role: "user", content: "Hello, World!" }]);
  });

  it("should handle IChatMessages with system message first", () => {
    const messages: IChatMessages = [
      { role: "system", content: "This is a system message" },
      { role: "user", content: "Hello, World!" },
    ];
    const outputObj: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, {}, outputObj);

    expect(outputObj).toEqual({ system: "This is a system message" });
    expect(result).toEqual([{ role: "user", content: "Hello, World!" }]);
  });

  it("should handle IChatMessages without system message first", () => {
    const messages: IChatMessages = [
      { role: "user", content: "Hello, World!" },
      { role: "assistant", content: "Hi there!" },
    ];
    const outputObj: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, {}, outputObj);

    expect(outputObj).toEqual({});
    expect(result).toEqual(messages);
  });

  it("should handle IChatMessages with system message first and later", () => {
    const messages: IChatMessages = [
      { role: "system", content: "This is a system message" },
      { role: "user", content: "Hello, World!" },
      {
        role: "system",
        content: "This is a second system message that gets converted to user",
      },
    ];
    const outputObj: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, {}, outputObj);

    expect(outputObj).toEqual({ system: "This is a system message" });
    expect(result).toEqual([
      { role: "user", content: "Hello, World!" },
      {
        role: "user",
        content: "This is a second system message that gets converted to user",
      },
    ]);
  });

  it("should handle IChatMessages with system message later", () => {
    const messages: IChatMessages = [
      { role: "user", content: "Hello, World!" },
      {
        role: "user",
        content: "This is a second system message that gets converted to user",
      },
    ];
    const outputObj: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, {}, outputObj);

    expect(typeof outputObj.system).toBe("undefined");
    expect(result).toEqual([
      { role: "user", content: "Hello, World!" },
      {
        role: "user",
        content: "This is a second system message that gets converted to user",
      },
    ]);
  });

  it("should handle non-system first message with system messages later", () => {
    const messages: IChatMessages = [
      { role: "user", content: "User message" },
      { role: "system", content: "System message that should become user" },
      { role: "assistant", content: "Assistant response" },
    ];
    const outputObj: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, {}, outputObj);

    expect(outputObj).toEqual({});
    expect(result).toEqual([
      { role: "user", content: "User message" },
      { role: "user", content: "System message that should become user" },
      { role: "assistant", content: "Assistant response" },
    ]);
  });

  describe("trailing assistant message prefill warning", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("should warn when last message is assistant on claude-opus-4-6", () => {
      const messages: IChatMessages = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(messages, { model: "claude-opus-4-6" }, {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("does not support assistant message prefills")
      );
    });

    it("should warn when last message is assistant on claude-opus-4-7", () => {
      const messages: IChatMessages = [
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(messages, { model: "claude-opus-4-7" }, {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("should warn when last message is assistant on claude-sonnet-4-6", () => {
      const messages: IChatMessages = [
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(messages, { model: "claude-sonnet-4-6" }, {});
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it.each([
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-fable-5",
    ])(
      "should warn on newer prefill-unsupported model %s (confirmed 400s live)",
      (model) => {
        const messages: IChatMessages = [
          { role: "user", content: "What's 2+2?" },
          { role: "assistant", content: "The answer is" },
        ];
        anthropicPromptSanitize(messages, { model }, {});
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("does not support assistant message prefills")
        );
      }
    );

    it("should not warn on 4.5-generation models that support prefills", () => {
      const messages: IChatMessages = [
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(messages, { model: "claude-haiku-4-5" }, {});
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should warn for dated model variants", () => {
      const messages: IChatMessages = [
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(
        messages,
        { model: "claude-opus-4-7-20260501" },
        {}
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("should not warn on older models that support prefills", () => {
      const messages: IChatMessages = [
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(
        messages,
        { model: "claude-3-5-sonnet-latest" },
        {}
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should not warn when last message is not assistant", () => {
      const messages: IChatMessages = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "What's 2+2?" },
      ];
      anthropicPromptSanitize(messages, { model: "claude-opus-4-7" }, {});
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should not warn when model is not provided", () => {
      const messages: IChatMessages = [
        { role: "user", content: "What's 2+2?" },
        { role: "assistant", content: "The answer is" },
      ];
      anthropicPromptSanitize(messages, {}, {});
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("mergeConsecutiveSameRole", () => {
    it("should merge consecutive tool_result messages with array content", () => {
      const messages: IChatMessages = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Call two tools" },
      ];

      // Simulate what happens when anthropicPromptMessageCallback produces
      // consecutive user messages with array content (tool results)
      const outputObj: Record<string, any> = {};
      const result = anthropicPromptSanitize(messages, {}, outputObj);

      expect(outputObj).toEqual({ system: "You are helpful" });
      expect(result).toEqual([
        { role: "user", content: "Call two tools" },
      ]);
    });

    it("should merge consecutive assistant tool_use messages with array content", () => {
      const messages = [
        { role: "user" as const, content: "Do something" },
        {
          role: "assistant" as const,
          content: "response",
          function_call: { id: "call-1", name: "fn1", arguments: "{}" },
        },
        {
          role: "assistant" as const,
          content: "response2",
          function_call: { id: "call-2", name: "fn2", arguments: "{}" },
        },
      ] as any;
      const outputObj: Record<string, any> = {};
      const result = anthropicPromptSanitize(messages, {}, outputObj);

      // After anthropicPromptMessageCallback, function_call messages become
      // assistant messages with array content (tool_use blocks).
      // Consecutive same-role with array content should be merged.
      expect(result.length).toBe(2); // user + merged assistant
      expect(result[0].role).toBe("user");
      expect(result[1].role).toBe("assistant");
      expect(Array.isArray(result[1].content)).toBe(true);
      expect(result[1].content).toHaveLength(2); // both tool_use blocks merged
    });

    it("should merge consecutive function (tool_result) messages", () => {
      const messages: IChatMessages = [
        { role: "user", content: "Do something" },
        {
          role: "assistant",
          content: "calling tools",
          function_call: [
            { id: "call-1", name: "fn1", arguments: "{}" },
            { id: "call-2", name: "fn2", arguments: "{}" },
          ],
        },
        {
          role: "function",
          id: "call-1",
          content: "result1",
          name: "fn1",
        } as any,
        {
          role: "function",
          id: "call-2",
          content: "result2",
          name: "fn2",
        } as any,
      ];
      const outputObj: Record<string, any> = {};
      const result = anthropicPromptSanitize(messages, {}, outputObj);

      // function messages become user messages with array content
      // consecutive user messages with array content should be merged
      expect(result.length).toBe(3); // user + assistant + merged user (tool results)
      expect(result[0].role).toBe("user");
      expect(result[1].role).toBe("assistant");
      expect(result[2].role).toBe("user");
      expect(Array.isArray(result[2].content)).toBe(true);
      expect(result[2].content).toHaveLength(2);
    });

    it("should not merge consecutive messages with string content", () => {
      const messages: IChatMessages = [
        { role: "user", content: "Message 1" },
        { role: "user", content: "Message 2" },
      ];
      const outputObj: Record<string, any> = {};
      const result = anthropicPromptSanitize(messages, {}, outputObj);

      // String content should NOT be merged
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: "user", content: "Message 1" });
      expect(result[1]).toEqual({ role: "user", content: "Message 2" });
    });

    it("should not merge messages with different roles", () => {
      const messages: IChatMessages = [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
        { role: "user", content: "Follow up" },
      ];
      const outputObj: Record<string, any> = {};
      const result = anthropicPromptSanitize(messages, {}, outputObj);

      expect(result).toHaveLength(3);
    });
  });
});
