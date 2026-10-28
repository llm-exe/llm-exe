import { LlmExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";

/**
 * Issue #893: withTraceId() is instance-wide, so concurrent executions on a
 * shared executor overwrite each other's trace ID. execute(input, { traceId })
 * scopes the trace ID to a single call.
 */
describe("llm-exe:executor per-call traceId", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "something" });
  const prompt = createChatPrompt<{ q: string }>("Answer: {{q}}");

  it("keeps each concurrent execution's traceId in hooks and context", async () => {
    const seen: Record<string, string | null | undefined> = {};
    const contextTraceIds: (string | undefined)[] = [];
    const executor = new LlmExecutor({ llm, prompt });
    const origHandler = executor.handler.bind(executor);
    executor.handler = async (input, options, context) => {
      contextTraceIds.push(context?.traceId);
      // small async gap so the executions interleave
      await new Promise((r) => setTimeout(r, 5));
      return origHandler(input, options, context);
    };
    executor.on("onComplete", (execution, executorMetadata) => {
      seen[execution.input.q] = executorMetadata.traceId;
    });

    await Promise.all(
      ["a", "b", "c"].map((id) => executor.execute({ q: id }, { traceId: id }))
    );

    expect(seen).toEqual({ a: "a", b: "b", c: "c" });
    expect(contextTraceIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("per-call traceId takes precedence over withTraceId()", async () => {
    const seen: (string | null | undefined)[] = [];
    const executor = new LlmExecutor({ llm, prompt }).withTraceId("instance");
    executor.on("onSuccess", (_e, meta) => seen.push(meta.traceId));

    await executor.execute({ q: "x" }, { traceId: "call" });
    await executor.execute({ q: "y" });

    expect(seen).toEqual(["call", "instance"]);
    // the instance value is not mutated by a per-call traceId
    expect(executor.getTraceId()).toBe("instance");
  });

  it("passes the per-call traceId to onError hooks", async () => {
    const seen: (string | null | undefined)[] = [];
    const executor = new LlmExecutor({ llm, prompt });
    executor.handler = async () => {
      throw new Error("boom");
    };
    executor.on("onError", (_e, meta) => seen.push(meta.traceId));

    await expect(
      executor.execute({ q: "x" }, { traceId: "err-1" })
    ).rejects.toThrow("boom");
    expect(seen).toEqual(["err-1"]);
  });

  it("ignores an empty or non-string traceId option", async () => {
    const seen: (string | null | undefined)[] = [];
    const executor = new LlmExecutor({ llm, prompt }).withTraceId("instance");
    executor.on("onSuccess", (_e, meta) => seen.push(meta.traceId));

    await executor.execute({ q: "x" }, { traceId: "" });
    await executor.execute({ q: "x" }, { traceId: 123 as any });

    expect(seen).toEqual(["instance", "instance"]);
  });
});
