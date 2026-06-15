import { LlmExecutor } from "@/executor";
import { useLlm } from "@/llm";
import { BaseLlmOutput } from "@/llm/output/base";
import { JsonParser } from "@/parser";
import { createChatPrompt } from "@/prompt";
import { defineSchema } from "@/utils/modules/defineSchema";
import { LlmExeError } from "@/errors";

/**
 * Tests LlmExecutor
 */
describe("llm-exe:executor/LlmExecutor", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "something" });
  const prompt = createChatPrompt("This is a prompt.");
  it("has basic properties", () => {
    const executor = new LlmExecutor({ llm, prompt });
    expect(executor).toHaveProperty("id");
    expect(executor).toHaveProperty("name");
    expect(executor).toHaveProperty("created");
    expect(executor).toHaveProperty("executions");
    expect(executor).toHaveProperty("hooks");

    expect(executor).toHaveProperty("execute");
    expect(typeof executor.execute).toEqual("function");

    expect(executor).toHaveProperty("getHandlerInput");
    expect(typeof executor.getHandlerInput).toEqual("function");

    expect(executor).toHaveProperty("getHandlerOutput");
    expect(typeof executor.getHandlerOutput).toEqual("function");

    expect(executor).toHaveProperty("metadata");
    expect(typeof executor.metadata).toEqual("function");

    expect(executor).toHaveProperty("getMetadata");
    expect(typeof executor.getMetadata).toEqual("function");

    expect(executor).toHaveProperty("runHook");
    expect(typeof executor.runHook).toEqual("function");

    expect(executor).toHaveProperty("setHooks");
    expect(typeof executor.setHooks).toEqual("function");
  });

  it("MockExecutor has basic properties", async () => {
    const executor = new LlmExecutor({ llm, prompt });

    jest.spyOn(executor, "getHandlerInput");
    jest.spyOn(executor, "getHandlerOutput");
    jest.spyOn(executor, "runHook");

    const input = { input: "input-value" };
    await executor.execute(input);

    expect(executor.runHook).toHaveBeenCalledTimes(2);

    expect(executor.runHook).toHaveBeenNthCalledWith(
      1,
      "onSuccess",
      expect.any(Object)
    );
    expect(executor.runHook).toHaveBeenNthCalledWith(
      2,
      "onComplete",
      expect.any(Object)
    );

    expect(executor.getHandlerInput).toHaveBeenCalledWith(
      { input: "input-value" },
      expect.objectContaining({ input }),
      undefined
    );
    expect(executor.getHandlerOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        getResult: expect.any(Function),
        getResultContent: expect.any(Function),
        getResultText: expect.any(Function),
      }),
      expect.objectContaining({ input }),
      undefined,
      expect.objectContaining({
        executor: expect.objectContaining({ type: "llm-executor" }),
        execution: expect.objectContaining({ input }),
        attributes: {},
      })
    );
  });
  it("MockExecutor returns correct result from execute", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    const response = await executor.execute({ input: "input-value" });
    expect(response).toEqual(
      'Hello world from LLM! The input was [{"role":"system","content":"This is a prompt."}]'
    );
  });
  it("MockExecutor returns correct result from execute", async () => {
    const promptAsFn = () =>
      createChatPrompt("This is a prompt from a function");
    const executor = new LlmExecutor({ llm, prompt: promptAsFn });
    const response = await executor.execute({ input: "input-value" });
    expect(response).toEqual(
      'Hello world from LLM! The input was [{"role":"system","content":"This is a prompt from a function"}]'
    );
  });
  it("MockExecutor throws error if no prompt", async () => {
    const executor = new LlmExecutor({ llm, prompt: undefined } as any);
    try {
      await executor.execute({ input: "input-value" });
    } catch (e: any) {
      expect(e.message).toEqual("Missing prompt");
    }
  });

  it("throws LlmExeError with executor.missing_prompt when no prompt is configured", async () => {
    const executor = new LlmExecutor({ llm, prompt: undefined } as any);
    try {
      await executor.execute({ input: "input-value" });
      throw new Error("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("executor.missing_prompt");
      expect((e as LlmExeError).category).toBe("executor");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("LlmExecutor.getHandlerInput");
      expect(ctx.executorName).toBeDefined();
      expect(ctx.executorType).toBe("llm-executor");
    }
  });
  it("MockExecutor returns metadata", async () => {
    const executor = new LlmExecutor({ llm, prompt });

    const initialMetadata = executor.getMetadata();
    expect(typeof initialMetadata).toEqual("object");
    expect(initialMetadata).toHaveProperty("executions");
    expect(initialMetadata).toHaveProperty("name");
    expect(initialMetadata).toHaveProperty("id");

    expect(initialMetadata).toHaveProperty("llm");

    expect(executor.getMetadata().executions).toEqual(0);
    await executor.execute({ input: "input-value" });
    expect(executor.getMetadata().executions).toEqual(1);

    expect(executor.getMetadata().id).toEqual(initialMetadata.id);
  });

  it("MockExecutor metadata returns persists after executions", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    const initialMetadata = executor.getMetadata();

    expect(executor.getMetadata().executions).toEqual(0);
    await executor.execute({ input: "input-value" });
    expect(executor.getMetadata().executions).toEqual(1);

    expect(executor.getMetadata().id).toEqual(initialMetadata.id);
    expect(executor.getMetadata().created).toEqual(initialMetadata.created);
    expect(executor.getMetadata().name).toEqual(initialMetadata.name);

    await executor.execute({ input: "input-value" });
    expect(executor.getMetadata().executions).toEqual(2);

    expect(executor.getMetadata().id).toEqual(initialMetadata.id);
    expect(executor.getMetadata().created).toEqual(initialMetadata.created);
    expect(executor.getMetadata().name).toEqual(initialMetadata.name);

    await executor.execute({ input: "input-value" });
    expect(executor.getMetadata().executions).toEqual(3);

    expect(executor.getMetadata().id).toEqual(initialMetadata.id);
    expect(executor.getMetadata().created).toEqual(initialMetadata.created);
    expect(executor.getMetadata().name).toEqual(initialMetadata.name);
  });

  it("MockExecutor getHandlerOutput gets correct inputs", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    jest.spyOn(executor, "getHandlerOutput");
    const input = { input: "input-value" };
    await executor.execute(input);
    const response = `Hello world from LLM! The input was [{\"role\":\"system\",\"content\":\"This is a prompt.\"}]`;
    expect(response).toEqual(response);
  });

  it("MockLlm can use withTraceId", () => {
    const llm = useLlm("openai.chat-mock.v1", {
      traceId: "llm-traceId",
      openAiApiKey: "",
      model: "text-ada-001",
    });
    const executor = new LlmExecutor({ llm, prompt });
    expect(executor.getTraceId()).toEqual("llm-traceId");
  });
  it("MockLlm can use withTraceId", () => {
    const llm = useLlm("openai.chat-mock.v1", {
      traceId: "llm-traceId",
      openAiApiKey: "",
      model: "text-ada-001",
    });
    const executor = new LlmExecutor({ llm, prompt });
    executor.withTraceId("1234");
    expect(executor.getTraceId()).toEqual("1234");
  });

  it("MockExecutor getHandlerOutput gets correct inputs", async () => {
    const schema = defineSchema({
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      },
    });
    const parser = new JsonParser({ schema });
    const executor = new LlmExecutor({ llm, prompt, parser });
    jest.spyOn(executor, "handler").mockResolvedValue(BaseLlmOutput({
      stopReason: "stop",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      content: [{ type: "text", text: '[{"name":"Greg","age":1}]' }],
    }));

    const input = { input: "input-value" };
    await executor.execute(input);

    expect(executor.handler).toHaveBeenCalledWith(
      [{ content: "This is a prompt.", role: "system" }],
      {
        jsonSchema: schema,
      },
      expect.objectContaining({
        executor: expect.objectContaining({ type: "llm-executor" }),
        execution: expect.objectContaining({ input }),
        attributes: {},
      })
    );
  });

  it("MockExecutor getHandlerOutput gets correct inputs", async () => {
    const schema = defineSchema({
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      },
    });

    const _prompt = createChatPrompt("This is a prompt.");
    // kill this to get test coverage of condition
    (_prompt as any).formatAsync = undefined;

    const parser = new JsonParser({ schema });
    const executor = new LlmExecutor({ llm, prompt: _prompt, parser });
    jest.spyOn(executor, "handler").mockResolvedValue(BaseLlmOutput({
      stopReason: "stop",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      content: [{ type: "text", text: '[{"name":"Greg","age":1}]' }],
    }));
    jest.spyOn(_prompt, "format");

    const input = { input: "input-value" };
    await executor.execute(input);
    expect(_prompt.format).toHaveBeenCalledWith(input);
  });

  it("getHandlerInput uses sync format when formatAsync is not a promise function", async () => {
    const syncPrompt = {
      format: jest.fn().mockReturnValue(["formatted"]),
      formatAsync: function() { return "not a promise"; }, // Regular function, not async
    };
    const promptFn = jest.fn().mockReturnValue(syncPrompt);
    
    const executor = new LlmExecutor({ 
      llm, 
      prompt: promptFn as any 
    });
    
    const result = await executor.getHandlerInput({ test: "input" });
    
    expect(promptFn).toHaveBeenCalledWith({ test: "input" });
    expect(syncPrompt.format).toHaveBeenCalledWith({ test: "input" });
    expect(result).toEqual(["formatted"]);
  });

  it("throws TypeError when execute is called with null (issue #410)", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    await expect(executor.execute(null as any)).rejects.toThrow(TypeError);
    await expect(executor.execute(null as any)).rejects.toThrow(
      /received null or undefined as input/
    );
  });

  it("throws TypeError when execute is called with undefined (issue #410)", async () => {
    const executor = new LlmExecutor({ llm, prompt });
    await expect(executor.execute(undefined as any)).rejects.toThrow(TypeError);
    await expect(executor.execute(undefined as any)).rejects.toThrow(
      /received null or undefined as input/
    );
  });

  it("getHandlerOutput uses getResult when parser target is function_call", async () => {
    const mockParser = {
      target: "function_call",
      parse: jest.fn().mockReturnValue([{ type: "function_use", name: "fn", input: {} }]),
    };
    const executor = new LlmExecutor({ llm, prompt, parser: mockParser as any });

    const mockOutput = {
      getResult: jest.fn().mockReturnValue({ content: [{ type: "function_use", name: "fn", input: {} }] }),
      getResultText: jest.fn().mockReturnValue("text"),
      getResultContent: jest.fn(),
    };

    const result = executor.getHandlerOutput(mockOutput, {} as any);

    expect(mockOutput.getResult).toHaveBeenCalled();
    expect(mockOutput.getResultText).not.toHaveBeenCalled();
    expect(mockParser.parse).toHaveBeenCalledWith(
      { content: [{ type: "function_use", name: "fn", input: {} }] },
      {}
    );
    expect(result).toEqual([{ type: "function_use", name: "fn", input: {} }]);
  });

  it("getHandlerOutput uses getResultText when parser target is not function_call", async () => {
    const mockParser = {
      target: "text",
      parse: jest.fn().mockReturnValue("parsed text"),
    };
    const executor = new LlmExecutor({ llm, prompt, parser: mockParser as any });

    const mockOutput = {
      getResult: jest.fn(),
      getResultText: jest.fn().mockReturnValue("raw text from llm"),
      getResultContent: jest.fn(),
    };

    const result = executor.getHandlerOutput(mockOutput, {} as any);

    expect(mockOutput.getResultText).toHaveBeenCalled();
    expect(mockOutput.getResult).not.toHaveBeenCalled();
    expect(mockParser.parse).toHaveBeenCalledWith("raw text from llm", {});
    expect(result).toEqual("parsed text");
  });
});
