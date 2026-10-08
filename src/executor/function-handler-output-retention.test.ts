import { LlmExecutorWithFunctions } from "@/executor";
import { useLlm } from "@/llm";
import { BaseLlmOutput } from "@/llm/output/base";
import { createParser } from "@/parser";
import { createChatPrompt } from "@/prompt";

/**
 * Follow-up coverage for issue #805.
 *
 * `handler-output-retention.test.ts` pins the contract for the standard
 * `LlmExecutor`: when the parser throws, the already-billed provider response
 * is still visible to `onError` and `onComplete`, because
 * `BaseExecutor.execute` stores `handlerOutput` *before* calling
 * `getHandlerOutput`.
 *
 * `LlmExecutorWithFunctions` reaches that same code path through a different
 * parser — it wraps the user's parser in `LlmFunctionParser`, which delegates
 * to the inner parser whenever the response carries no `function_use` block.
 * So the wrapper can throw too, and a tool-call request is exactly the kind of
 * expensive call whose token accounting you most need to reconcile.
 *
 * These tests fail if `handlerOutput` is ever assigned after parsing, or if
 * the functions executor starts swallowing inner-parser errors.
 */
describe("llm-exe:executor/LlmExecutorWithFunctions handlerOutput retention when parsing fails", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

  const usage = {
    input_tokens: 913,
    output_tokens: 24,
    total_tokens: 937,
  };

  const functionOptions = { functionCall: "auto" as const, functions: [] };

  function buildExecutor(
    hooks: Record<string, any>,
    response = BaseLlmOutput({
      stopReason: "stop",
      usage,
      content: [{ type: "text" as const, text: "I am not JSON." }],
    })
  ) {
    const executor = new LlmExecutorWithFunctions(
      {
        llm,
        prompt: createChatPrompt("Call a tool or return JSON."),
        parser: createParser("json"),
      },
      { hooks }
    );
    jest.spyOn(executor, "handler").mockResolvedValue(response);
    return executor;
  }

  it("keeps the completed response on onError when the wrapped parser throws", async () => {
    let onErrorMeta: any = null;
    let onSuccessCalls = 0;

    const executor = buildExecutor({
      onError(meta: any) {
        onErrorMeta = meta;
      },
      onSuccess() {
        onSuccessCalls++;
      },
    });

    await expect(executor.execute({}, functionOptions)).rejects.toThrow(
      "Invalid JSON input."
    );

    expect(onSuccessCalls).toBe(0);
    expect(onErrorMeta).not.toBeNull();

    // The response survived the parser failure, intact.
    expect(onErrorMeta.handlerOutput).toBeDefined();
    const result = onErrorMeta.handlerOutput.getResult();
    expect(result.usage).toEqual(usage);
    expect(result.stopReason).toBe("stop");
    expect(onErrorMeta.handlerOutput.getResultText()).toBe("I am not JSON.");

    // ...but nothing was parsed, and the parser error is reported as-is.
    expect(onErrorMeta.output).toBeUndefined();
    expect(onErrorMeta.errorMessage).toBe("Invalid JSON input.");
    expect(onErrorMeta.error).toBeInstanceOf(Error);
  });

  it("keeps the completed response on onComplete when the wrapped parser throws", async () => {
    let onCompleteMeta: any = null;

    const executor = buildExecutor({
      onComplete(meta: any) {
        onCompleteMeta = meta;
      },
    });

    await expect(executor.execute({}, functionOptions)).rejects.toThrow(
      "Invalid JSON input."
    );

    expect(onCompleteMeta.handlerOutput).toBeDefined();
    expect(onCompleteMeta.handlerOutput.getResult().usage).toEqual(usage);
    expect(onCompleteMeta.handlerOutput.getResult().stopReason).toBe("stop");
    expect(onCompleteMeta.output).toBeUndefined();
    expect(onCompleteMeta.errorMessage).toBe("Invalid JSON input.");
  });

  it("rejects with the inner parser error rather than swallowing it", async () => {
    const executor = buildExecutor({});

    const error = await executor.execute({}, functionOptions).then(
      () => null,
      (err: any) => err
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Invalid JSON input.");
    expect(error.code).toBe("parser.parse_failed");
  });

  it("retains cached token accounting through a parser failure", async () => {
    let onErrorMeta: any = null;

    const cachedUsage = {
      input_tokens: 4096,
      output_tokens: 31,
      total_tokens: 4127,
      cache_read_input_tokens: 3900,
      cache_creation_input_tokens: 196,
    };

    const executor = buildExecutor(
      {
        onError(meta: any) {
          onErrorMeta = meta;
        },
      },
      BaseLlmOutput({
        stopReason: "stop",
        usage: cachedUsage,
        content: [{ type: "text", text: "still not JSON" }],
      })
    );

    await expect(executor.execute({}, functionOptions)).rejects.toThrow(
      "Invalid JSON input."
    );

    // Cached tokens are billed too — they must survive the parse failure.
    expect(onErrorMeta.handlerOutput.getResult().usage).toEqual(cachedUsage);
  });

  it("still records handlerOutput alongside output on the tool-call path", async () => {
    let onSuccessMeta: any = null;

    const content = [
      {
        type: "function_use" as const,
        name: "get_weather",
        input: { city: "Denver" },
        functionId: "call-1",
      },
    ];

    const executor = buildExecutor(
      {
        onSuccess(meta: any) {
          onSuccessMeta = meta;
        },
      },
      BaseLlmOutput({
        stopReason: "tool_use",
        usage,
        content,
      })
    );

    // A function_use block short-circuits the inner parser: the normalized
    // content passes straight through, so the json parser never runs.
    await expect(executor.execute({}, functionOptions)).resolves.toEqual(
      content
    );

    expect(onSuccessMeta.handlerOutput).toBeDefined();
    expect(onSuccessMeta.handlerOutput.getResult().usage).toEqual(usage);
    expect(onSuccessMeta.output).toEqual(content);
  });

  it("leaves handlerOutput absent when the LLM call itself fails", async () => {
    let onErrorMeta: any = null;

    const executor = new LlmExecutorWithFunctions(
      {
        llm,
        prompt: createChatPrompt("Call a tool or return JSON."),
        parser: createParser("json"),
      },
      {
        hooks: {
          onError(meta: any) {
            onErrorMeta = meta;
          },
        },
      }
    );
    jest
      .spyOn(executor, "handler")
      .mockRejectedValue(new Error("upstream timeout"));

    await expect(executor.execute({}, functionOptions)).rejects.toThrow(
      "upstream timeout"
    );

    expect(onErrorMeta.handlerOutput).toBeUndefined();
    expect(onErrorMeta.output).toBeUndefined();
    expect(onErrorMeta.errorMessage).toBe("upstream timeout");
  });

  it("does not leak a previous tool-call response into a failed execution", async () => {
    const metas: any[] = [];

    const executor = new LlmExecutorWithFunctions(
      {
        llm,
        prompt: createChatPrompt("Call a tool or return JSON."),
        parser: createParser("json"),
      },
      {
        hooks: {
          onComplete(meta: any) {
            metas.push(meta);
          },
        },
      }
    );

    const handler = jest.spyOn(executor, "handler");

    const content = [
      {
        type: "function_use" as const,
        name: "get_weather",
        input: { city: "Denver" },
        functionId: "call-1",
      },
    ];

    handler.mockResolvedValueOnce(
      BaseLlmOutput({ stopReason: "tool_use", usage, content })
    );
    await expect(executor.execute({}, functionOptions)).resolves.toEqual(
      content
    );

    handler.mockRejectedValueOnce(new Error("upstream timeout"));
    await expect(executor.execute({}, functionOptions)).rejects.toThrow(
      "upstream timeout"
    );

    expect(metas).toHaveLength(2);
    expect(metas[0].handlerOutput).toBeDefined();
    expect(metas[0].output).toEqual(content);

    // Metadata is per-execution — the successful tool call must not bleed through.
    expect(metas[1].handlerOutput).toBeUndefined();
    expect(metas[1].output).toBeUndefined();
    expect(metas[1].errorMessage).toBe("upstream timeout");
  });
});
