import {
  createLlmExecutor,
  createLlmFunctionExecutor,
} from "@/executor";
import { BaseLlmOutput } from "@/llm/output/base";
import { createChatPrompt } from "@/prompt";
import { createCustomParser, createParser } from "@/parser";
import { ExecutionContext } from "@/types";

/**
 * Per-call ExecutionContext: built by BaseExecutor.execute(),
 * threaded through handler/llm.call/parser, surfaces in deprecation warnings.
 */
describe("llm-exe:executor execution-context", () => {
  function mockLlm(opts?: { traceId?: string }) {
    const calls: any[] = [];
    let traceId: string | null = opts?.traceId ?? null;
    return {
      _calls: calls,
      call: async (
        messages: any,
        options: any,
        context?: ExecutionContext
      ) => {
        calls.push({ messages, options, context });
        return BaseLlmOutput({
          stopReason: "stop",
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
          content: [{ type: "text", text: "ok" }],
        });
      },
      getTraceId: () => traceId,
      withTraceId: (id: string) => {
        traceId = id;
      },
      getMetadata: () => ({ traceId }),
    };
  }

  it("LlmExecutor passes ExecutionContext as the 3rd arg of llm.call", async () => {
    const llm = mockLlm();
    const prompt = createChatPrompt("Hello");
    const parser = createParser("string");
    const executor = createLlmExecutor({
      name: "summarizer",
      llm: llm as any,
      prompt,
      parser,
    });

    await executor.execute({});

    expect(llm._calls).toHaveLength(1);
    const context = llm._calls[0].context as ExecutionContext;
    expect(context).toBeDefined();
    expect(context.executor.name).toBe("summarizer");
    expect(context.executor.type).toBe("llm-executor");
    expect(context.execution.input).toEqual({});
    expect(context.attributes).toEqual({});
  });

  it("context.traceId resolves to the executor's traceId when set", async () => {
    const llm = mockLlm({ traceId: "llm-trace" });
    const prompt = createChatPrompt("Hello");
    const executor = createLlmExecutor({
      name: "with-trace",
      llm: llm as any,
      prompt,
      parser: createParser("string"),
    });
    executor.withTraceId("executor-trace");

    await executor.execute({});

    expect(llm._calls[0].context.traceId).toBe("executor-trace");
  });

  it("context.traceId falls back to the LLM's traceId when executor has none", async () => {
    const llm = mockLlm({ traceId: "llm-trace" });
    const prompt = createChatPrompt("Hello");
    const executor = createLlmExecutor({
      name: "fallback-trace",
      llm: llm as any,
      prompt,
      parser: createParser("string"),
    });

    await executor.execute({});

    expect(llm._calls[0].context.traceId).toBe("llm-trace");
  });

  it("context.traceId is undefined when neither side has one", async () => {
    const llm = mockLlm();
    const prompt = createChatPrompt("Hello");
    const executor = createLlmExecutor({
      name: "no-trace",
      llm: llm as any,
      prompt,
      parser: createParser("string"),
    });

    await executor.execute({});

    expect(llm._calls[0].context.traceId).toBeUndefined();
  });

  it("CustomParser receives ExecutionContext, not bare execution metadata", async () => {
    const llm = mockLlm();
    const prompt = createChatPrompt("Hello");
    let captured: ExecutionContext | undefined;
    const parser = createCustomParser("capture", (_text, context) => {
      captured = context;
      return _text;
    });
    const executor = createLlmExecutor({
      name: "parser-context",
      llm: llm as any,
      prompt,
      parser,
    });

    await executor.execute({});

    expect(captured).toBeDefined();
    expect(captured!.executor.name).toBe("parser-context");
    expect(captured!.execution).toBeDefined();
    expect(captured!.execution.handlerInput).toBeDefined();
    expect(captured!.execution.handlerOutput).toBeDefined();
    expect(captured!.attributes).toEqual({});
  });

  it("direct llm.call without context still works (no executor in the picture)", async () => {
    const llm = mockLlm();
    const result = await llm.call([{ role: "system", content: "Hi" }] as any, {});
    expect(result.getResultText()).toBe("ok");
    expect(llm._calls[0].context).toBeUndefined();
  });

  it("LlmExecutorWithFunctions forwards ExecutionContext to wrapped CustomParser on text-fallback", async () => {
    // Text-fallback path: model returns plain text (no function_use blocks).
    // LlmFunctionParser must forward context to the inner CustomParser.
    const llm = mockLlm();
    const prompt = createChatPrompt("Hello");
    let captured: ExecutionContext | undefined;
    const parser = createCustomParser("capture-fn", (_text, context) => {
      captured = context;
      return _text;
    });
    const executor = createLlmFunctionExecutor({
      name: "fn-parser-context",
      llm: llm as any,
      prompt,
      parser,
    });

    await executor.execute({}, {});

    expect(captured).toBeDefined();
    expect(captured!.executor.name).toBe("fn-parser-context");
    expect(captured!.executor.type).toBe("llm-executor");
    expect(captured!.execution.handlerInput).toBeDefined();
    expect(captured!.attributes).toEqual({});
  });
});
