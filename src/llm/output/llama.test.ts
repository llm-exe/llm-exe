import { OutputMetaLlama3Chat } from "@/llm/output/llama";

describe("llm-exe:output/OutputMetaLlama3Chat", () => {
  const mock = {
    stop_reason: "end_turn",
    prompt_token_count: 427,
    generation_token_count: 1,
    generation: "This is the assistant message content.",
  };

  it("creates output with expected properties", () => {
    const output = OutputMetaLlama3Chat(mock);
    expect(output).toHaveProperty("id");
    expect(output).toHaveProperty("name");
    expect(output).toHaveProperty("created");
    expect(output).toHaveProperty("content");
    expect(output).toHaveProperty("usage");
    expect(output).toHaveProperty("stopReason");
    expect(output).toHaveProperty("options");
  });

  it("creates output with correct values", () => {
    const output = OutputMetaLlama3Chat(mock);
    expect(output.content).toEqual([{ type: "text", text: mock.generation }]);
  });

  it("formats content correctly", () => {
    const output = OutputMetaLlama3Chat(mock);
    expect(output.content).toEqual([
      {
        type: "text",
        text: "This is the assistant message content.",
      },
    ]);
    expect(output.stopReason).toEqual("end_turn");
  });

  it("computes usage from prompt and generation token counts", () => {
    const output = OutputMetaLlama3Chat(mock);
    expect(output.usage).toEqual({
      input_tokens: 427,
      output_tokens: 1,
      total_tokens: 428,
    });
  });

  it("returns the input_tokens + output_tokens sum as total_tokens", () => {
    const output = OutputMetaLlama3Chat({
      ...mock,
      prompt_token_count: 100,
      generation_token_count: 25,
    });
    expect(output.usage.total_tokens).toBe(125);
  });

  it("falls back to 'meta' as name when no config is supplied", () => {
    const output = OutputMetaLlama3Chat(mock);
    expect(output.name).toBe("meta");
  });

  it("falls back to 'meta' as name when config.options.model.default is not provided", () => {
    const output = OutputMetaLlama3Chat(mock, {
      options: { model: {} },
    } as any);
    expect(output.name).toBe("meta");
  });

  it("uses config.options.model.default for name when provided", () => {
    const output = OutputMetaLlama3Chat(mock, {
      options: { model: { default: "meta.llama3-8b-instruct-v1:0" } },
    } as any);
    expect(output.name).toBe("meta.llama3-8b-instruct-v1:0");
  });

  it("generates a unique id per call", () => {
    const a = OutputMetaLlama3Chat(mock);
    const b = OutputMetaLlama3Chat(mock);
    expect(a.id).not.toBe(b.id);
    expect(typeof a.id).toBe("string");
    expect(a.id.length).toBeGreaterThan(0);
  });

  it("sets created to a numeric timestamp at call time", () => {
    const before = Date.now();
    const output = OutputMetaLlama3Chat(mock);
    const after = Date.now();
    expect(typeof output.created).toBe("number");
    expect(output.created).toBeGreaterThanOrEqual(before);
    expect(output.created).toBeLessThanOrEqual(after);
  });

  it("preserves an empty generation string in content", () => {
    const output = OutputMetaLlama3Chat({
      ...mock,
      generation: "",
    });
    expect(output.content).toEqual([{ type: "text", text: "" }]);
  });

  it("propagates the stop_reason verbatim", () => {
    const output = OutputMetaLlama3Chat({
      ...mock,
      stop_reason: "max_tokens",
    });
    expect(output.stopReason).toBe("max_tokens");
  });

  it("returns options as an empty array", () => {
    const output = OutputMetaLlama3Chat(mock);
    expect(output.options).toEqual([]);
  });

  it("handles zero token counts cleanly", () => {
    const output = OutputMetaLlama3Chat({
      stop_reason: "stop",
      prompt_token_count: 0,
      generation_token_count: 0,
      generation: "hi",
    });
    expect(output.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
  });
});
