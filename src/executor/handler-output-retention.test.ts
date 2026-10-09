import { createLlmExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { BaseLlmOutput } from "@/llm/output/base";
import { createParser } from "@/parser";
import { createChatPrompt } from "@/prompt";

/**
 * Regression tests for issue #805.
 *
 * When a parser throws, the LLM call has already completed and has already
 * been billed. BaseExecutor.execute stores `handlerOutput` in the metadata
 * state *before* calling getHandlerOutput (which is where parsing happens), so
 * the error and completion hooks still see the full provider response —
 * usage, stopReason and content included.
 *
 * These tests fail if `handlerOutput` is ever assigned after parsing: the
 * hooks would silently receive `handlerOutput: undefined` and consumers would
 * lose token accounting for exactly the calls they most need to reconcile.
 */
describe("llm-exe:executor handlerOutput retention when parsing fails", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

  const usage = {
    input_tokens: 412,
    output_tokens: 87,
    total_tokens: 499,
  };

  function buildExecutor(
    hooks: Record<string, any>,
    response = BaseLlmOutput({
      stopReason: "stop",
      usage,
      content: [{ type: "text" as const, text: "I am not JSON." }],
    })
  ) {
    const executor = createLlmExecutor(
      {
        llm,
        prompt: createChatPrompt("Return JSON."),
        parser: createParser("json"),
      },
      { hooks }
    );
    jest.spyOn(executor, "handler").mockResolvedValue(response);
    return executor;
  }

  it("keeps the completed response on onError when the parser throws", async () => {
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

    await expect(executor.execute({})).rejects.toThrow("Invalid JSON input.");

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

  it("keeps the completed response on onComplete when the parser throws", async () => {
    let onCompleteMeta: any = null;

    const executor = buildExecutor({
      onComplete(meta: any) {
        onCompleteMeta = meta;
      },
    });

    await expect(executor.execute({})).rejects.toThrow("Invalid JSON input.");

    expect(onCompleteMeta.handlerOutput).toBeDefined();
    expect(onCompleteMeta.handlerOutput.getResult().usage).toEqual(usage);
    expect(onCompleteMeta.handlerOutput.getResult().stopReason).toBe("stop");
    expect(onCompleteMeta.output).toBeUndefined();
    expect(onCompleteMeta.errorMessage).toBe("Invalid JSON input.");
  });

  it("rejects with the parser error rather than swallowing it", async () => {
    const executor = buildExecutor({});

    const error = await executor.execute({}).then(
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
      input_tokens: 1200,
      output_tokens: 40,
      total_tokens: 1240,
      cache_read_input_tokens: 1024,
      cache_creation_input_tokens: 128,
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

    await expect(executor.execute({})).rejects.toThrow("Invalid JSON input.");

    // Cached tokens are billed too — they must survive the parse failure.
    expect(onErrorMeta.handlerOutput.getResult().usage).toEqual(cachedUsage);
  });

  describe("handler rejection before a response exists", () => {
    it("leaves handlerOutput absent when the LLM call itself fails", async () => {
      let onErrorMeta: any = null;

      const executor = createLlmExecutor(
        {
          llm,
          prompt: createChatPrompt("Return JSON."),
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

      await expect(executor.execute({})).rejects.toThrow("upstream timeout");

      expect(onErrorMeta.handlerOutput).toBeUndefined();
      expect(onErrorMeta.output).toBeUndefined();
      expect(onErrorMeta.errorMessage).toBe("upstream timeout");
    });

    it("does not leak a previous execution's response into a failed one", async () => {
      const metas: any[] = [];

      const executor = createLlmExecutor(
        {
          llm,
          prompt: createChatPrompt("Return JSON."),
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

      handler.mockResolvedValueOnce(
        BaseLlmOutput({
          stopReason: "stop",
          usage,
          content: [{ type: "text", text: '{"ok":true}' }],
        })
      );
      await expect(executor.execute({})).resolves.toEqual({ ok: true });

      handler.mockRejectedValueOnce(new Error("upstream timeout"));
      await expect(executor.execute({})).rejects.toThrow("upstream timeout");

      expect(metas).toHaveLength(2);
      expect(metas[0].handlerOutput).toBeDefined();
      expect(metas[0].output).toEqual({ ok: true });

      // Metadata is per-execution — the successful call must not bleed through.
      expect(metas[1].handlerOutput).toBeUndefined();
      expect(metas[1].output).toBeUndefined();
      expect(metas[1].errorMessage).toBe("upstream timeout");
    });
  });
});
