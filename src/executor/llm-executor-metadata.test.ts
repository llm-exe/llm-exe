import { createLlmExecutor, createCoreExecutor } from "@/executor";
import { LlmExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";
import { createParser, createCustomParser } from "@/parser";

/**
 * Tests for executor metadata flow — verifying that hooks receive
 * complete, correct metadata during success and error paths.
 */
describe("llm-exe:executor metadata in hooks", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

  describe("onSuccess metadata", () => {
    it("provides complete metadata with input, output, and timing", async () => {
      let capturedMeta: any = null;
      let capturedExecMeta: any = null;

      const prompt = createChatPrompt<{ text: string }>("Echo: {{text}}");
      const parser = createParser("string");
      const executor = createLlmExecutor(
        { llm, prompt, parser },
        {
          hooks: {
            onSuccess(meta, execMeta) {
              capturedMeta = meta;
              capturedExecMeta = execMeta;
            },
          },
        }
      );

      await executor.execute({ text: "hello" });

      expect(capturedMeta).not.toBeNull();
      expect(capturedMeta.input).toEqual({ text: "hello" });
      expect(capturedMeta.output).toBeDefined();
      expect(typeof capturedMeta.output).toBe("string");
      expect(capturedMeta.start).toEqual(expect.any(Number));
      expect(capturedMeta.handlerInput).toBeDefined();
      expect(capturedMeta.handlerOutput).toBeDefined();
      expect(capturedMeta.error).toBeUndefined();
      expect(capturedMeta.errorMessage).toBeUndefined();

      expect(capturedExecMeta).toBeDefined();
      expect(capturedExecMeta.id).toBeDefined();
      expect(capturedExecMeta.name).toBe("anonymous-llm-executor");
      expect(capturedExecMeta.executions).toBe(1);
    });

    it("handlerInput contains formatted prompt messages", async () => {
      let handlerInput: any = null;
      const prompt = createChatPrompt<{ name: string }>(
        "Greet {{name}}"
      );
      const executor = createLlmExecutor(
        { llm, prompt },
        {
          hooks: {
            onSuccess(meta) {
              handlerInput = meta.handlerInput;
            },
          },
        }
      );

      await executor.execute({ name: "Alice" });

      expect(Array.isArray(handlerInput)).toBe(true);
      expect(handlerInput[0]).toEqual(
        expect.objectContaining({ role: "system", content: "Greet Alice" })
      );
    });
  });

  describe("onError metadata", () => {
    it("provides error details alongside input", async () => {
      let capturedMeta: any = null;

      const prompt = createChatPrompt("Test error");
      const parser = createCustomParser("fail", () => {
        throw new Error("parser exploded");
      });
      const executor = createLlmExecutor(
        { llm, prompt, parser },
        {
          hooks: {
            onError(meta) {
              capturedMeta = meta;
            },
          },
        }
      );

      await expect(executor.execute({})).rejects.toThrow("parser exploded");

      expect(capturedMeta).not.toBeNull();
      expect(capturedMeta.error).toBeInstanceOf(Error);
      expect(capturedMeta.errorMessage).toBe("parser exploded");
      expect(capturedMeta.input).toEqual({});
      expect(capturedMeta.output).toBeUndefined();
    });

    it("retains handlerOutput when the handler resolved and parsing failed", async () => {
      let capturedMeta: any = null;

      const prompt = createChatPrompt("Test error");
      const parser = createCustomParser("fail", () => {
        throw new Error("parser exploded");
      });
      const executor = createLlmExecutor(
        { llm, prompt, parser },
        {
          hooks: {
            onError(meta) {
              capturedMeta = meta;
            },
          },
        }
      );

      await expect(executor.execute({})).rejects.toThrow("parser exploded");

      // The provider returned a billable response before parsing threw, so
      // usage is still recoverable from the raw handler output.
      expect(capturedMeta.handlerOutput).toBeDefined();
      expect(capturedMeta.handlerOutput.getResult().usage).toEqual(
        expect.objectContaining({ total_tokens: expect.any(Number) })
      );
      expect(capturedMeta.output).toBeUndefined();
    });

    it("omits handlerOutput in onError and onComplete when the handler itself failed", async () => {
      let errorMeta: any = null;
      let completeMeta: any = null;

      const prompt = createChatPrompt("Test error");
      const executor = createLlmExecutor(
        { llm, prompt },
        {
          hooks: {
            onError(meta) {
              errorMeta = meta;
            },
            onComplete(meta) {
              completeMeta = meta;
            },
          },
        }
      );

      jest
        .spyOn(llm, "call")
        .mockRejectedValueOnce(new Error("provider unreachable"));

      await expect(executor.execute({})).rejects.toThrow(
        "provider unreachable"
      );

      expect(errorMeta.handlerOutput).toBeUndefined();
      expect(completeMeta.handlerOutput).toBeUndefined();
    });
  });

  describe("handlerOutput availability in onComplete", () => {
    it("is present in onComplete on both the success and parse-failure paths", async () => {
      const capture: Record<string, any> = {};

      const prompt = createChatPrompt("Accounting test");
      const makeExecutor = (parser?: any) =>
        createLlmExecutor(
          { llm, prompt, ...(parser ? { parser } : {}) },
          {
            hooks: {
              onComplete(meta) {
                capture[parser ? "failed" : "succeeded"] = meta;
              },
            },
          }
        );

      await makeExecutor().execute({});

      const failing = makeExecutor(
        createCustomParser("fail", () => {
          throw new Error("parser exploded");
        })
      );
      await expect(failing.execute({})).rejects.toThrow("parser exploded");

      // onComplete can serve as a single accounting point: usage is readable
      // whether or not parsing succeeded, without double-counting.
      expect(capture.succeeded.handlerOutput.getResult().usage).toBeDefined();
      expect(capture.failed.handlerOutput.getResult().usage).toBeDefined();
      expect(capture.succeeded.output).toBeDefined();
      expect(capture.failed.output).toBeUndefined();
    });
  });

  describe("onComplete metadata", () => {
    it("includes end timestamp on success", async () => {
      let capturedMeta: any = null;

      const prompt = createChatPrompt("Timing test");
      const executor = createLlmExecutor(
        { llm, prompt },
        {
          hooks: {
            onComplete(meta) {
              capturedMeta = meta;
            },
          },
        }
      );

      await executor.execute({});

      expect(capturedMeta.start).toEqual(expect.any(Number));
      expect(capturedMeta.end).toEqual(expect.any(Number));
      expect(capturedMeta.end).toBeGreaterThanOrEqual(capturedMeta.start);
    });

    it("includes end timestamp on error", async () => {
      let capturedMeta: any = null;

      const prompt = createChatPrompt("Timing error test");
      const parser = createCustomParser("fail", () => {
        throw new Error("boom");
      });
      const executor = createLlmExecutor(
        { llm, prompt, parser },
        {
          hooks: {
            onComplete(meta) {
              capturedMeta = meta;
            },
          },
        }
      );

      await expect(executor.execute({})).rejects.toThrow("boom");

      expect(capturedMeta.start).toEqual(expect.any(Number));
      expect(capturedMeta.end).toEqual(expect.any(Number));
      expect(capturedMeta.end).toBeGreaterThanOrEqual(capturedMeta.start);
      expect(capturedMeta.errorMessage).toBe("boom");
    });
  });

  describe("executor naming", () => {
    it("uses custom name when provided", () => {
      const prompt = createChatPrompt("Named executor");
      const executor = new LlmExecutor({
        llm,
        prompt,
        name: "my-summarizer",
      });

      expect(executor.getMetadata().name).toBe("my-summarizer");
    });

    it("defaults to anonymous-llm-executor when no name provided", () => {
      const prompt = createChatPrompt("Default name");
      const executor = new LlmExecutor({ llm, prompt });

      expect(executor.getMetadata().name).toBe("anonymous-llm-executor");
    });
  });

  describe("CoreExecutor metadata in hooks", () => {
    it("passes full metadata shape to onSuccess", async () => {
      let captured: any = null;
      const handler = (input: { x: number }) => input.x * 3;
      const executor = createCoreExecutor(handler, {
        hooks: {
          onSuccess(meta) {
            captured = meta;
          },
        },
      });

      const result = await executor.execute({ x: 7 });

      expect(result).toBe(21);
      expect(captured.input).toEqual({ x: 7 });
      expect(captured.output).toBe(21);
      expect(captured.start).toEqual(expect.any(Number));
    });

    it("passes error metadata to onError on failure", async () => {
      let captured: any = null;
      const handler = () => {
        throw new Error("core failed");
      };
      const executor = createCoreExecutor(handler, {
        hooks: {
          onError(meta) {
            captured = meta;
          },
        },
      });

      await expect(executor.execute({})).rejects.toThrow("core failed");

      expect(captured.errorMessage).toBe("core failed");
      expect(captured.error).toBeInstanceOf(Error);
    });
  });
});
