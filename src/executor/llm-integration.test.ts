import { createLlmExecutor, createCoreExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { BaseLlmOutput } from "@/llm/output/base";
import { createChatPrompt } from "@/prompt";
import { createParser, createCustomParser } from "@/parser";

/**
 * Integration tests: Prompt → LLM (mock) → Parser → Typed Result
 * These tests exercise the full executor pipeline end-to-end.
 */
describe("llm-exe:executor integration (prompt → LLM → parser)", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

  it("executes with string parser and returns string", async () => {
    const prompt = createChatPrompt("Say hello");
    const parser = createParser("string");
    const executor = createLlmExecutor({ llm, prompt, parser });

    const result = await executor.execute({});
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("executes with boolean parser", async () => {
    const booleanLlm = {
      call: async () =>
        BaseLlmOutput({
          stopReason: "stop",
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
          content: [{ type: "text", text: "true" }],
        }),
      getTraceId: () => null,
      withTraceId: () => undefined,
      getMetadata: () => ({}),
    };
    const prompt = createChatPrompt("Is this true?");
    const parser = createParser("boolean");
    const executor = createLlmExecutor({ llm: booleanLlm, prompt, parser });

    const result = await executor.execute({});
    expect(typeof result).toBe("boolean");
    expect(result).toBe(true);
  });

  it("executes with number parser on numeric content", async () => {
    const prompt = createChatPrompt("Return 42");
    const numParser = createCustomParser("to-number", () => 42);
    const executor = createLlmExecutor({ llm, prompt, parser: numParser });

    const result = await executor.execute({});
    expect(result).toBe(42);
  });

  it("executes with custom parser that transforms output", async () => {
    const prompt = createChatPrompt("Say something");
    const parser = createCustomParser("upper", (text) => text.toUpperCase());
    const executor = createLlmExecutor({ llm, prompt, parser });

    const result = await executor.execute({});
    expect(typeof result).toBe("string");
    expect(result).toBe(result.toUpperCase());
  });

  it("executes with custom parser returning structured data", async () => {
    const prompt = createChatPrompt("Say something");
    const parser = createCustomParser("wrap", (text) => ({
      raw: text,
      length: text.length,
    }));
    const executor = createLlmExecutor({ llm, prompt, parser });

    const result = await executor.execute({});
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("length");
    expect(typeof result.raw).toBe("string");
    expect(result.length).toBe(result.raw.length);
  });

  it("passes template variables through to the prompt", async () => {
    const prompt = createChatPrompt<{ name: string }>("Hello {{name}}");
    const parser = createParser("string");
    const executor = createLlmExecutor({ llm, prompt, parser });

    const result = await executor.execute({ name: "World" });
    // The mock LLM echoes the formatted prompt content
    expect(result).toContain("Hello World");
  });

  it("tracks execution count across multiple calls", async () => {
    const prompt = createChatPrompt("Test");
    const executor = createLlmExecutor({ llm, prompt });

    expect(executor.getMetadata().executions).toBe(0);
    await executor.execute({});
    expect(executor.getMetadata().executions).toBe(1);
    await executor.execute({});
    expect(executor.getMetadata().executions).toBe(2);
  });

  it("fires onSuccess and onComplete hooks", async () => {
    const onSuccess = jest.fn();
    const onComplete = jest.fn();
    const prompt = createChatPrompt("Test hooks");
    const executor = createLlmExecutor(
      { llm, prompt },
      { hooks: { onSuccess, onComplete } }
    );

    await executor.execute({});
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires onError hook when parser throws", async () => {
    const onError = jest.fn();
    const onComplete = jest.fn();
    const prompt = createChatPrompt("Test error");
    const parser = createCustomParser("failing", () => {
      throw new Error("parse failed");
    });
    const executor = createLlmExecutor(
      { llm, prompt, parser },
      { hooks: { onError, onComplete } }
    );

    await expect(executor.execute({})).rejects.toThrow("parse failed");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("createCoreExecutor wraps a sync handler", async () => {
    const handler = (input: { x: number }) => input.x * 2;
    const executor = createCoreExecutor(handler);

    const result = await executor.execute({ x: 5 });
    expect(result).toBe(10);
  });

  it("createCoreExecutor wraps an async handler", async () => {
    const handler = async (input: { x: number }) => input.x + 1;
    const executor = createCoreExecutor(handler);

    const result = await executor.execute({ x: 10 });
    expect(result).toBe(11);
  });

  it("prompt as function is evaluated per execution", async () => {
    let callCount = 0;
    const promptFn = () => {
      callCount++;
      return createChatPrompt(`Call ${callCount}`);
    };
    const executor = createLlmExecutor({ llm, prompt: promptFn });

    await executor.execute({});
    expect(callCount).toBe(1);
    await executor.execute({});
    expect(callCount).toBe(2);
  });

  it("executor preserves identity across executions", async () => {
    const prompt = createChatPrompt("Stable");
    const executor = createLlmExecutor({ llm, prompt });

    const meta1 = executor.getMetadata();
    await executor.execute({});
    const meta2 = executor.getMetadata();

    expect(meta1.id).toBe(meta2.id);
    expect(meta1.created).toBe(meta2.created);
    expect(meta2.executions).toBe(meta1.executions + 1);
  });

  it("withTraceId persists across executions", async () => {
    const prompt = createChatPrompt("Trace test");
    const executor = createLlmExecutor({ llm, prompt });

    executor.withTraceId("trace-abc");
    expect(executor.getTraceId()).toBe("trace-abc");

    await executor.execute({});
    expect(executor.getTraceId()).toBe("trace-abc");
  });
});
