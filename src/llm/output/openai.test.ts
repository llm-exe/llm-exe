import { OutputOpenAIChat } from "./openai";
import { BaseLlmOutput } from "./base";

describe("OutputOpenAIChat", () => {
  const baseResponse = {
    id: "chatcmpl-123",
    object: "chat.completion",
    model: "gpt-4o-mini",
    created: 1700000000,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "Hello, world!",
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  };

  it("parses a standard text response", () => {
    const output = OutputOpenAIChat(baseResponse as any);
    expect(output).toEqual({
      id: "chatcmpl-123",
      name: "gpt-4o-mini",
      created: 1700000000,
      stopReason: "stop",
      content: [{ type: "text", text: "Hello, world!" }],
      options: [],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
    });
  });

  it("parses a response with tool calls", () => {
    const response = {
      ...baseResponse,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_abc123",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"location": "NYC"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };

    const output = OutputOpenAIChat(response as any);
    expect(output.content).toEqual([
      {
        type: "function_use",
        functionId: "call_abc123",
        name: "get_weather",
        input: { location: "NYC" },
      },
    ]);
    expect(output.stopReason).toBe("tool_calls");
  });

  it("parses a response with both text and tool calls", () => {
    const response = {
      ...baseResponse,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Let me check the weather.",
            tool_calls: [
              {
                id: "call_xyz",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"city": "London"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };

    const output = OutputOpenAIChat(response as any);
    expect(output.content).toHaveLength(2);
    expect(output.content[0]).toEqual({
      type: "text",
      text: "Let me check the weather.",
    });
    expect(output.content[1]).toEqual({
      type: "function_use",
      functionId: "call_xyz",
      name: "get_weather",
      input: { city: "London" },
    });
  });

  it("parses multiple tool calls", () => {
    const response = {
      ...baseResponse,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "get_weather", arguments: '{"city": "NYC"}' },
              },
              {
                id: "call_2",
                type: "function",
                function: { name: "get_time", arguments: '{"timezone": "EST"}' },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };

    const output = OutputOpenAIChat(response as any);
    expect(output.content).toHaveLength(2);
    expect((output.content[0] as any).name).toBe("get_weather");
    expect((output.content[1] as any).name).toBe("get_time");
  });

  it("handles multiple choices (options)", () => {
    const response = {
      ...baseResponse,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "First choice" },
          finish_reason: "stop",
        },
        {
          index: 1,
          message: { role: "assistant", content: "Second choice" },
          finish_reason: "stop",
        },
      ],
    };

    const output = OutputOpenAIChat(response as any);
    expect(output.content).toEqual([{ type: "text", text: "First choice" }]);
    expect(output.options).toHaveLength(1);
  });

  it("falls back to config model name when response model is missing", () => {
    const response = { ...baseResponse, model: undefined };
    const config = { options: { model: { default: "gpt-4" } } };

    const output = OutputOpenAIChat(response as any, config as any);
    expect(output.name).toBe("gpt-4");
  });

  it("falls back to openai.unknown when no model info available", () => {
    const response = { ...baseResponse, model: undefined };
    const output = OutputOpenAIChat(response as any);
    expect(output.name).toBe("openai.unknown");
  });

  it("handles empty choices array", () => {
    const response = { ...baseResponse, choices: [] };
    const output = OutputOpenAIChat(response as any);
    expect(output.content).toEqual([]);
    expect(output.options).toEqual([]);
  });

  it("handles missing usage data", () => {
    const response = { ...baseResponse, usage: undefined };
    const output = OutputOpenAIChat(response as any);
    expect(output.usage).toEqual({
      input_tokens: undefined,
      output_tokens: undefined,
      total_tokens: undefined,
    });
  });

  it("handles undefined choices", () => {
    const response = { ...baseResponse, choices: undefined };
    const output = OutputOpenAIChat(response as any);
    expect(output.content).toEqual([]);
    expect(output.options).toEqual([]);
    expect(output.stopReason).toBeUndefined();
  });

  it("handles tool call with non-JSON arguments", () => {
    const response = {
      ...baseResponse,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "echo", arguments: "plain text not json" },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };

    const output = OutputOpenAIChat(response as any);
    expect(output.content[0]).toEqual({
      type: "function_use",
      functionId: "call_1",
      name: "echo",
      input: {},
    });
  });

  it("preserves response id and created timestamp", () => {
    const output = OutputOpenAIChat(baseResponse as any);
    expect(output.id).toBe("chatcmpl-123");
    expect(output.created).toBe(1700000000);
  });
  describe("malformed and edge-case choices", () => {
    const withChoice = (choice: any, extra: any[] = []) =>
      OutputOpenAIChat({ ...baseResponse, choices: [choice, ...extra] } as any);

    it("keeps an empty-string content as a text block (not dropped)", () => {
      const output = withChoice({
        index: 0,
        message: { role: "assistant", content: "" },
        finish_reason: "stop",
      });
      expect(output.content).toEqual([{ type: "text", text: "" }]);
    });

    it("returns no content when message is missing entirely", () => {
      const output = withChoice({ index: 0, finish_reason: "length" });
      expect(output.content).toEqual([]);
      expect(output.stopReason).toBe("length");
    });

    it("returns no content for null content and no tool calls (e.g. refusal)", () => {
      const output = withChoice({
        index: 0,
        message: { role: "assistant", content: null, refusal: "I can't help" },
        finish_reason: "stop",
      });
      expect(output.content).toEqual([]);
    });

    it("ignores non-string content values", () => {
      const output = withChoice({
        index: 0,
        message: { role: "assistant", content: 42 },
        finish_reason: "stop",
      });
      expect(output.content).toEqual([]);
    });

    it("handles an empty tool_calls array", () => {
      const output = withChoice({
        index: 0,
        message: { role: "assistant", content: "hi", tool_calls: [] },
        finish_reason: "stop",
      });
      expect(output.content).toEqual([{ type: "text", text: "hi" }]);
    });

    it("maps empty-string tool arguments to an empty object", () => {
      const output = withChoice({
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "c1", type: "function", function: { name: "noop", arguments: "" } },
          ],
        },
        finish_reason: "tool_calls",
      });
      expect(output.content).toEqual([
        { type: "function_use", functionId: "c1", name: "noop", input: {} },
      ]);
    });

    it("parses nested JSON tool arguments", () => {
      const output = withChoice({
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: {
                name: "search",
                arguments: '{"q":"x","filters":{"tags":["a","b"]},"limit":3}',
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      });
      expect(output.content[0]).toEqual({
        type: "function_use",
        functionId: "c1",
        name: "search",
        input: { q: "x", filters: { tags: ["a", "b"] }, limit: 3 },
      });
    });

    it("preserves tool-call order and keeps text first", () => {
      const output = withChoice({
        index: 0,
        message: {
          role: "assistant",
          content: "thinking",
          tool_calls: [
            { id: "b", type: "function", function: { name: "two", arguments: "{}" } },
            { id: "a", type: "function", function: { name: "one", arguments: "{}" } },
          ],
        },
        finish_reason: "tool_calls",
      });
      expect(output.content.map((c: any) => c.type)).toEqual([
        "text",
        "function_use",
        "function_use",
      ]);
      expect(output.content.slice(1).map((c: any) => c.functionId)).toEqual([
        "b",
        "a",
      ]);
    });

    // BUG: formatOptions wraps formatResult's array in another array, so each
    // option is OutputResultContent[][] at runtime despite the declared type.
    it.failing("normalizes tool calls inside alternate choices (options)", () => {
      const output = withChoice(
        {
          index: 0,
          message: { role: "assistant", content: "first" },
          finish_reason: "stop",
        },
        [
          {
            index: 1,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                { id: "o1", type: "function", function: { name: "alt", arguments: '{"n":1}' } },
              ],
            },
            finish_reason: "tool_calls",
          },
        ]
      );
      expect(output.content).toEqual([{ type: "text", text: "first" }]);
      expect(output.options).toEqual([
        [{ type: "function_use", functionId: "o1", name: "alt", input: { n: 1 } }],
      ]);
    });

    it("takes stopReason from the first choice only", () => {
      const output = withChoice(
        { index: 0, message: { role: "assistant", content: "a" }, finish_reason: "length" },
        [{ index: 1, message: { role: "assistant", content: "b" }, finish_reason: "stop" }]
      );
      expect(output.stopReason).toBe("length");
    });
  });

  describe("alternate choices via BaseLlmOutput accessors", () => {
    const threeChoices = {
      ...baseResponse,
      choices: ["A", "B", "C"].map((text, index) => ({
        index,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      })),
    };

    it("getResultText(0) returns the first choice", () => {
      const out = BaseLlmOutput(OutputOpenAIChat(threeChoices as any));
      expect(out.getResultText(0)).toBe("A");
      expect(out.getResultText()).toBe("A");
    });

    // BUG: options are double-nested and getResultText/getResultContent index
    // options[i] instead of options[i - 1], so alternates are unreachable.
    it.failing("getResultText(n) returns the nth alternate choice", () => {
      const out = BaseLlmOutput(OutputOpenAIChat(threeChoices as any));
      expect(out.getResultText(1)).toBe("B");
      expect(out.getResultText(2)).toBe("C");
    });

    it.failing("getResultContent(1) returns the second choice's content blocks", () => {
      const out = BaseLlmOutput(OutputOpenAIChat(threeChoices as any));
      expect(out.getResultContent(1)).toEqual([{ type: "text", text: "B" }]);
    });

    it.failing("each option is a flat OutputResultContent[]", () => {
      const raw = OutputOpenAIChat(threeChoices as any);
      expect(raw.options).toEqual([
        [{ type: "text", text: "B" }],
        [{ type: "text", text: "C" }],
      ]);
    });
  });
});
