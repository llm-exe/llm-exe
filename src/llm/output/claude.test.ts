import { OutputAnthropicClaude3Chat } from "@/llm/output/claude";

/**
 * Tests the OutputAnthropicClaude3Chat function
 */
describe("llm-exe:output/OutputAnthropicClaude3Chat", () => {
  const mock = {
    id: "chatcmpl-7KfsdfdsfZj1waHPfsdEZ",
    model: "claude-3-5-sonnet-20240620",
    type: "message",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 427,
      total_tokens: 854,
      output_tokens: 1,
    },
    content: [
      {
        type: "text",
        text: "This is the assistant message content.",
      },
    ],
  };

  it("creates output with expected properties", () => {
    const output = OutputAnthropicClaude3Chat(mock as any);
    expect(output).toHaveProperty("id");
    expect(output).toHaveProperty("name");
    expect(output).toHaveProperty("content");
    expect(output).toHaveProperty("usage");
    expect(output).toHaveProperty("stopReason");
  });
  it("creates output with correct values", () => {
    const output = OutputAnthropicClaude3Chat(mock as any);
    expect(output.id).toEqual(mock.id);
    expect(output.name).toEqual(mock.model);
    expect(output.content).toEqual(mock.content);
    expect(output.usage).toEqual({
      input_tokens: mock.usage.input_tokens,
      output_tokens: mock.usage.output_tokens,
      total_tokens: mock.usage.input_tokens + mock.usage.output_tokens,
    });
  });
  it("formats content correctly", () => {
    const output = OutputAnthropicClaude3Chat(mock as any);
    expect(output.content).toEqual([
      {
        type: "text",
        text: "This is the assistant message content.",
      },
    ]);
    expect(output.stopReason).toEqual("end_turn");
  });

  const mock_tools = {
    id: "msg_01HwEDvPa9f1cjZanHVrZdG3",
    type: "message",
    role: "assistant",
    model: "claude-3-5-sonnet-20240620",
    content: [
      {
        type: "text",
        text: "Certainly!",
      },
      {
        type: "tool_use",
        id: "toolu_01EJ17EQLV15S2b45FHD1t6w",
        name: "move",
        input: {
          direction: "right",
        },
      },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: {
      input_tokens: 418,
      output_tokens: 124,
    },
  };

  it("handles tool_use content correctly", () => {
    const output = OutputAnthropicClaude3Chat(mock_tools as any);
    expect(output.content).toEqual([
      { type: "text", text: "Certainly!" },
      {
        type: "function_use",
        name: "move",
        input: { direction: "right" },
        functionId: "toolu_01EJ17EQLV15S2b45FHD1t6w",
      },
    ]);
    expect(output.stopReason).toEqual("tool_use");
  });

  it("handles empty content array", () => {
    const mockWithEmptyContent = {
      ...mock,
      content: [],
    };
    const output = OutputAnthropicClaude3Chat(mockWithEmptyContent as any);
    expect(output.content).toEqual([]);
  });

  it("handles undefined content", () => {
    const mockWithoutContent = {
      id: "test-id",
      model: "claude-3",
      stop_reason: "stop",
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
    };
    const output = OutputAnthropicClaude3Chat(mockWithoutContent as any);
    expect(output.content).toEqual([]);
  });

  it("uses default model name when model is undefined and no config", () => {
    const mockWithoutModel = {
      ...mock,
      model: undefined,
    };
    const output = OutputAnthropicClaude3Chat(mockWithoutModel as any);
    expect(output.name).toBe("anthropic.unknown");
  });

  it("uses config default model when model is undefined", () => {
    const mockWithoutModel = {
      ...mock,
      model: undefined,
    };
    const config = {
      options: {
        model: {
          default: "claude-from-config",
        },
      },
    };
    const output = OutputAnthropicClaude3Chat(
      mockWithoutModel as any,
      config as any,
    );
    expect(output.name).toBe("claude-from-config");
  });

  it("falls back to Bedrock header token counts when body usage is absent", () => {
    const result = {
      ...mock,
      usage: undefined,
    } as any;
    const output = OutputAnthropicClaude3Chat(result, undefined, {
      "x-amzn-bedrock-input-token-count": "427",
      "x-amzn-bedrock-output-token-count": "1",
    });
    expect(output.usage).toEqual({
      input_tokens: 427,
      output_tokens: 1,
      total_tokens: 428,
    });
  });

  it("returns zero usage instead of NaN when body and headers carry no counts", () => {
    const output = OutputAnthropicClaude3Chat({
      ...mock,
      usage: undefined,
    } as any);
    expect(output.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
  });

  describe("malformed and mixed responses", () => {
    it("skips unknown block types (thinking, server_tool_use) and keeps order", () => {
      const output = OutputAnthropicClaude3Chat({
        ...mock,
        content: [
          { type: "thinking", thinking: "hmm", signature: "sig" },
          { type: "text", text: "first" },
          {
            type: "server_tool_use",
            id: "srv_1",
            name: "web_search",
            input: {},
          },
          { type: "tool_use", id: "tu_1", name: "fn", input: { a: 1 } },
          { type: "text", text: "last" },
        ],
      } as any);
      expect(output.content).toEqual([
        { type: "text", text: "first" },
        {
          type: "function_use",
          functionId: "tu_1",
          name: "fn",
          input: { a: 1 },
        },
        { type: "text", text: "last" },
      ]);
    });

    it("treats null content as empty content", () => {
      expect(
        OutputAnthropicClaude3Chat({ ...mock, content: null } as any).content,
      ).toEqual([]);
    });

    it("keeps empty-string text blocks rather than dropping them", () => {
      const output = OutputAnthropicClaude3Chat({
        ...mock,
        content: [{ type: "text", text: "" }],
      } as any);
      expect(output.content).toEqual([{ type: "text", text: "" }]);
    });

    it("maps tool_use with empty input", () => {
      const output = OutputAnthropicClaude3Chat({
        ...mock,
        content: [{ type: "tool_use", id: "tu_2", name: "noargs", input: {} }],
      } as any);
      expect(output.content).toEqual([
        { type: "function_use", functionId: "tu_2", name: "noargs", input: {} },
      ]);
    });

    it("prefers body usage over Bedrock headers when both are present", () => {
      const output = OutputAnthropicClaude3Chat(mock as any, undefined, {
        "x-amzn-bedrock-input-token-count": "999",
        "x-amzn-bedrock-output-token-count": "999",
      });
      expect(output.usage).toEqual({
        input_tokens: 427,
        output_tokens: 1,
        total_tokens: 428,
      });
    });

    it("fills a missing body output count from headers but keeps body input", () => {
      const output = OutputAnthropicClaude3Chat(
        { ...mock, usage: { input_tokens: 10 } } as any,
        undefined,
        { "x-amzn-bedrock-output-token-count": "7" },
      );
      expect(output.usage).toEqual({
        input_tokens: 10,
        output_tokens: 7,
        total_tokens: 17,
      });
    });

    it("does not add body cache counts to a header-derived input count", () => {
      const output = OutputAnthropicClaude3Chat(
        {
          ...mock,
          usage: { output_tokens: 2, cache_read_input_tokens: 50 },
        } as any,
        undefined,
        { "x-amzn-bedrock-input-token-count": "100" },
      );
      expect(output.usage.input_tokens).toBe(100);
      expect(output.usage.cache_read_input_tokens).toBe(50);
      expect(output.usage.total_tokens).toBe(102);
    });

    it("treats input_tokens: 0 as present (adds cache counts, ignores headers)", () => {
      const output = OutputAnthropicClaude3Chat(
        {
          ...mock,
          usage: {
            input_tokens: 0,
            output_tokens: 3,
            cache_read_input_tokens: 20,
            cache_creation_input_tokens: 5,
          },
        } as any,
        undefined,
        { "x-amzn-bedrock-input-token-count": "999" },
      );
      expect(output.usage).toEqual({
        input_tokens: 25,
        output_tokens: 3,
        total_tokens: 28,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 5,
      });
    });

    it("copies cache_creation instead of aliasing the response object", () => {
      const cache_creation = { ephemeral_5m_input_tokens: 4 };
      const output = OutputAnthropicClaude3Chat({
        ...mock,
        usage: { input_tokens: 1, output_tokens: 1, cache_creation },
      } as any);
      expect(output.usage.cache_creation).toEqual(cache_creation);
      expect(output.usage.cache_creation).not.toBe(cache_creation);
    });

    it("passes stop_reason through, including tool_use and null", () => {
      expect(
        OutputAnthropicClaude3Chat({ ...mock, stop_reason: "tool_use" } as any)
          .stopReason,
      ).toBe("tool_use");
      expect(
        OutputAnthropicClaude3Chat({ ...mock, stop_reason: null } as any)
          .stopReason,
      ).toBeNull();
    });
  });
});
