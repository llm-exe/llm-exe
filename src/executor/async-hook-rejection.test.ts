import { LlmExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";

/**
 * Issue #891: runHook ignored the return value of hooks, so an async hook
 * that rejected became an unhandled promise rejection (fatal on Node >= 15).
 */
describe("llm-exe:executor async hook rejections", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "something" });
  const prompt = createChatPrompt<{ q: string }>("Answer: {{q}}");

  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
  });
  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  // Give the rejection time to be reported as unhandled if nothing caught it.
  const flush = () => new Promise((r) => setTimeout(r, 20));

  it.each(["onSuccess", "onComplete"] as const)(
    "a rejecting async %s hook does not cause an unhandled rejection",
    async (event) => {
      const executor = new LlmExecutor({ llm, prompt });
      executor.on(event, async () => {
        throw new Error("boom");
      });
      await expect(executor.execute({ q: "x" })).resolves.toEqual(
        expect.any(String)
      );
      await flush();
      expect(unhandled).toEqual([]);
    }
  );

  it("a rejecting async onError hook does not cause an unhandled rejection", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    executor.handler = async () => {
      throw new Error("handler failed");
    };
    executor.on("onError", async () => {
      throw new Error("boom");
    });
    await expect(executor.execute({ q: "x" })).rejects.toThrow(
      "handler failed"
    );
    await flush();
    expect(unhandled).toEqual([]);
  });

  it("a rejecting async once() hook does not cause an unhandled rejection and still self-removes", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    executor.once("onSuccess", async () => {
      throw new Error("boom");
    });
    await executor.execute({ q: "x" });
    await flush();
    expect(unhandled).toEqual([]);
    expect(executor.hooks.onSuccess).toHaveLength(0);
  });

  it("other hooks still run after an async hook rejects", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    const calls: string[] = [];
    executor.on("onSuccess", async () => {
      calls.push("first");
      throw new Error("boom");
    });
    executor.on("onSuccess", () => {
      calls.push("second");
    });
    await executor.execute({ q: "x" });
    await flush();
    expect(calls).toEqual(["first", "second"]);
    expect(unhandled).toEqual([]);
  });
});
