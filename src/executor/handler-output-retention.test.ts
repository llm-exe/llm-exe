import { createLlmExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";
import { createParser } from "@/parser";
import { BaseLlmOutput } from "@/llm/output/base";

/**
 * Regression tests for issue #805.
 *
 * `BaseExecutor.execute` assigns `handlerOutput` to the metadata state *before*
 * calling `getHandlerOutput` (which runs the parser). That ordering is an
 * accounting contract, not an accident: when a parser throws, the LLM call has
 * already completed and has already been billed. The onError / onComplete hooks
 * are where users record spend, so the completed response — including usage and
 * stopReason — has to survive the parse failure.
 *
 * If someone moves the `handlerOutput` assignment to after the parse, these
 * tests fail. That is the point.
 */
describe("llm-exe:executor handlerOutput retention on parse failure", () => {
  const USAGE = {
    input_tokens: 1200,
    output_tokens: 350,
    total_tokens: 1550,
    cache_read_input_tokens: 1024,
    cache_creation_input_tokens: 128,
  };

  /**
   * Builds an executor whose LLM returns a completed, billed response whose
   * text is not valid JSON, paired with a real JSON parser that will throw.
   */
  function setup(responseText: string) {
    const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

    const response = BaseLlmOutput({
      name: "mock",
      usage: USAGE,
      stopReason: "stop",
      content: [{ type: "text", text: responseText }],
    });

    jest.spyOn(llm, "call").mockResolvedValue(response as any);

    const calls = {
      onSuccess: jest.fn(),
      onError: jest.fn(),
      onComplete: jest.fn(),
    };

    const executor = createLlmExecutor(
      {
        llm,
        prompt: createChatPrompt<{ text: string }>("Echo: {{text}}"),
        parser: createParser("json"),
      },
      { hooks: calls }
    );

    return { executor, calls, response };
  }

  it("rejects with the parser error rather than swallowing it", async () => {
    const { executor } = setup("this is not json");

    await expect(executor.execute({ text: "hi" })).rejects.toThrow();
  });

  it("forwards the completed handlerOutput to onError when parsing fails", async () => {
    const { executor, calls, response } = setup("this is not json");

    await expect(executor.execute({ text: "hi" })).rejects.toThrow();

    expect(calls.onError).toHaveBeenCalledTimes(1);
    const meta = calls.onError.mock.calls[0][0];

    // The completed response survived the parse failure.
    expect(meta.handlerOutput).toBe(response);
    expect(meta.handlerOutput.getResult().usage).toEqual(USAGE);
    expect(meta.handlerOutput.getResult().stopReason).toBe("stop");

    // The parser error is reported, and no parsed output was recorded.
    expect(meta.error).toBeDefined();
    expect(meta.errorMessage).toEqual(expect.any(String));
    expect(meta.output).toBeUndefined();
  });

  it("forwards the completed handlerOutput to onComplete when parsing fails", async () => {
    const { executor, calls, response } = setup("this is not json");

    await expect(executor.execute({ text: "hi" })).rejects.toThrow();

    expect(calls.onComplete).toHaveBeenCalledTimes(1);
    const meta = calls.onComplete.mock.calls[0][0];

    expect(meta.handlerOutput).toBe(response);
    expect(meta.handlerOutput.getResult().usage).toEqual(USAGE);
    expect(meta.output).toBeUndefined();
    expect(meta.error).toBeDefined();
  });

  it("retains billed cache usage fields through the failure path", async () => {
    const { executor, calls } = setup("this is not json");

    await expect(executor.execute({ text: "hi" })).rejects.toThrow();

    const usage = calls.onError.mock.calls[0][0].handlerOutput.getResult().usage;

    // Cached tokens are billed too — losing them under-reports spend.
    expect(usage.cache_read_input_tokens).toBe(1024);
    expect(usage.cache_creation_input_tokens).toBe(128);
    expect(usage.input_tokens).toBe(1200);
    expect(usage.output_tokens).toBe(350);
  });

  it("does not run onSuccess when parsing fails", async () => {
    const { executor, calls } = setup("this is not json");

    await expect(executor.execute({ text: "hi" })).rejects.toThrow();

    expect(calls.onSuccess).not.toHaveBeenCalled();
  });

  it("leaves handlerOutput absent when the handler itself rejects", async () => {
    const llm = useLlm("openai.chat-mock.v1", { model: "mock" });
    jest.spyOn(llm, "call").mockRejectedValue(new Error("upstream exploded"));

    const onError = jest.fn();
    const executor = createLlmExecutor(
      {
        llm,
        prompt: createChatPrompt<{ text: string }>("Echo: {{text}}"),
        parser: createParser("json"),
      },
      { hooks: { onError } }
    );

    await expect(executor.execute({ text: "hi" })).rejects.toThrow(
      "upstream exploded"
    );

    const meta = onError.mock.calls[0][0];
    expect(meta.handlerOutput).toBeUndefined();
    expect(meta.output).toBeUndefined();
    expect(meta.errorMessage).toBe("upstream exploded");
  });

  it("does not leak a previous execution's response into a failed execution", async () => {
    const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

    const firstResponse = BaseLlmOutput({
      name: "mock",
      usage: USAGE,
      stopReason: "stop",
      content: [{ type: "text", text: `{"ok":true}` }],
    });

    const call = jest
      .spyOn(llm, "call")
      .mockResolvedValueOnce(firstResponse as any)
      .mockRejectedValueOnce(new Error("upstream exploded"));

    const onSuccess = jest.fn();
    const onError = jest.fn();
    const executor = createLlmExecutor(
      {
        llm,
        prompt: createChatPrompt<{ text: string }>("Echo: {{text}}"),
        parser: createParser("json"),
      },
      { hooks: { onSuccess, onError } }
    );

    // First execution succeeds and records a handlerOutput.
    await expect(executor.execute({ text: "hi" })).resolves.toEqual({
      ok: true,
    });
    expect(onSuccess.mock.calls[0][0].handlerOutput).toBe(firstResponse);

    // Second execution fails before a response exists. Metadata state is
    // per-execution, so the first response must not bleed through.
    await expect(executor.execute({ text: "hi again" })).rejects.toThrow(
      "upstream exploded"
    );

    const failedMeta = onError.mock.calls[0][0];
    expect(failedMeta.handlerOutput).toBeUndefined();
    expect(failedMeta.output).toBeUndefined();
    expect(call).toHaveBeenCalledTimes(2);
  });
});
