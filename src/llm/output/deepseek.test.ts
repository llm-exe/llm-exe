import { BaseLlmOutput } from "@/llm/output/base";
import { OpenAiResponse } from "@/interfaces";
import { OutputDeepSeekChat } from "@/llm/output/deepseek";

/**
 * Tests the TextPrompt class
 */
describe("llm-exe:output/OutputDeepSeekChat", () => {
  const mock = {
    id: "chatcmpl-7KfsdfdsfZj1waHPfsdEZ",
    object: "chat.completion",
    created: 1685025755,
    model: "gpt-3.5-turbo-0301",
    usage: {
      prompt_tokens: 427,
      completion_tokens: 1,
      total_tokens: 428,
    },
    choices: [
      {
        message: {
          role: "assistant",
          content: "This is the assistant message content.",
        },
        finish_reason: "stop",
        index: 0,
      },
    ],
  };
  it("creates output with expected properties", () => {
    const output = OutputDeepSeekChat(mock as any);
    expect(output).toHaveProperty("id");
    expect(output).toHaveProperty("name");
    expect(output).toHaveProperty("created");
    expect(output).toHaveProperty("content");
    expect(output).toHaveProperty("usage");
  });
  it("creates output with correct values", () => {
    const output = OutputDeepSeekChat(mock as any);
    expect(output.id).toEqual(mock.id);
    expect(output.name).toEqual(mock.model);
    expect(output.created).toEqual(mock.created);
    expect(output.usage).toEqual({
      input_tokens: mock.usage.prompt_tokens,
      output_tokens: mock.usage.completion_tokens,
      total_tokens: mock.usage.total_tokens,
    });
  });
  it("formats content correctly", () => {
    const output = OutputDeepSeekChat(mock as any);
    expect(output.content).toEqual([
      {
        type: "text",
        text: "This is the assistant message content.",
      },
    ]);
    expect(output.stopReason).toEqual("stop");
  });
  it("returns complete output structure", () => {
    const output = OutputDeepSeekChat(mock as any);
    expect(output).toEqual({
      content: [
        { text: "This is the assistant message content.", type: "text" },
      ],
      created: 1685025755,
      id: "chatcmpl-7KfsdfdsfZj1waHPfsdEZ",
      name: "gpt-3.5-turbo-0301",
      options: [],
      stopReason: "stop",
      usage: { input_tokens: 427, output_tokens: 1, total_tokens: 428 },
    });
  });

  it("handles tool_calls when content is null", () => {
    const output = OutputDeepSeekChat({
      id: "chatcmpl-7KfsdfdsfZj1waHPfsdEZ",
      object: "chat.completion",
      created: 1685025755,
      model: "gpt-3.5-turbo-0301",
      usage: {
        prompt_tokens: 427,
        completion_tokens: 1,
        total_tokens: 428,
      },
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: {
                  name: "test_fn",
                  arguments: "{}",
                },
              },
            ],
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
    } as unknown as OpenAiResponse);
    expect(output.content).toEqual([
      {
        functionId: "call_123",
        input: {},
        name: "test_fn",
        type: "function_use",
      },
    ]);
  });

  it("uses default model name when model is undefined and no config", () => {
    const mockWithoutModel = {
      ...mock,
      model: undefined,
    };
    const output = OutputDeepSeekChat(mockWithoutModel as any);
    expect(output.name).toBe("deepseek.unknown");
  });

  it("uses config default model when model is undefined", () => {
    const mockWithoutModel = {
      ...mock,
      model: undefined,
    };
    const config = {
      options: {
        model: {
          default: "deepseek-from-config",
        },
      },
    };
    const output = OutputDeepSeekChat(mockWithoutModel as any, config as any);
    expect(output.name).toBe("deepseek-from-config");
  });

  it("handles missing choices array", () => {
    const mockWithoutChoices = {
      ...mock,
      choices: undefined,
    };
    const output = OutputDeepSeekChat(mockWithoutChoices as any);
    expect(output.content).toEqual([]);
    expect(output.options).toEqual([]);
    expect(output.stopReason).toBeUndefined();
  });

  it("handles empty choices array", () => {
    const mockWithEmptyChoices = {
      ...mock,
      choices: [],
    };
    const output = OutputDeepSeekChat(mockWithEmptyChoices as any);
    expect(output.content).toEqual([]);
    expect(output.options).toEqual([]);
    expect(output.stopReason).toBeUndefined();
  });

  describe("alternate choices via BaseLlmOutput accessors", () => {
    const threeChoices = {
      ...mock,
      choices: ["A", "B", "C"].map((text, index) => ({
        index,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      })),
    };

    it("getResultText(n) returns the nth choice", () => {
      const out = BaseLlmOutput(OutputDeepSeekChat(threeChoices as any));
      expect(out.getResultText()).toBe("A");
      expect(out.getResultText(0)).toBe("A");
      expect(out.getResultText(1)).toBe("B");
      expect(out.getResultText(2)).toBe("C");
    });

    it("getResultContent(n) returns the nth choice's content blocks", () => {
      const out = BaseLlmOutput(OutputDeepSeekChat(threeChoices as any));
      expect(out.getResultContent(0)).toEqual([{ type: "text", text: "A" }]);
      expect(out.getResultContent(2)).toEqual([{ type: "text", text: "C" }]);
    });

    it("each option is a flat OutputResultContent[]", () => {
      const raw = OutputDeepSeekChat(threeChoices as any);
      expect(raw.options).toEqual([
        [{ type: "text", text: "B" }],
        [{ type: "text", text: "C" }],
      ]);
    });

    it("normalizes tool calls in an alternate choice", () => {
      const raw = OutputDeepSeekChat({
        ...mock,
        choices: [
          threeChoices.choices[0],
          {
            index: 1,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "lookup", arguments: '{"q":"x"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      } as any);
      expect(raw.stopReason).toBe("stop");
      expect(BaseLlmOutput(raw).getResultContent(1)).toEqual([
        {
          type: "function_use",
          functionId: "call_1",
          name: "lookup",
          input: { q: "x" },
        },
      ]);
    });
  });

  it("an empty-content alternate keeps later choices at their index", () => {
    const out = BaseLlmOutput(
      OutputDeepSeekChat({
        ...mock,
        choices: ["A", "", "C"].map((text, index) => ({
          index,
          message: { role: "assistant", content: text },
          finish_reason: "stop",
        })),
      } as any),
    );
    expect(out.getResultContent(1)).toEqual([]);
    expect(out.getResultText(1)).toBe("");
    expect(out.getResultText(2)).toBe("C");
  });
});
