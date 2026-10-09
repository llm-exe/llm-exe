import { createLlmExecutor } from "@/executor";
import { BaseLlmOutput } from "@/llm/output/base";
import { createChatPrompt } from "@/prompt";
import { createParser } from "@/parser";
import { isLlmExeError } from "@/errors";

const usage = {
  input_tokens: 512,
  output_tokens: 1024,
  total_tokens: 1536,
  cache_read_input_tokens: 256,
  cache_creation_input_tokens: 64,
};

function mockLlm(text: string, stopReason = "length") {
  return {
    call: async () =>
      BaseLlmOutput({
        stopReason,
        usage,
        content: [{ type: "text", text }],
      }),
    getTraceId: () => null,
    withTraceId: () => undefined,
    getMetadata: () => ({}),
  } as any;
}

describe("llm-exe:executor parser failure response context", () => {
  const prompt = createChatPrompt("Return json");

  it("gives direct catch callers usage and stopReason", async () => {
    const executor = createLlmExecutor({
      llm: mockLlm('{"a": '),
      prompt,
      parser: createParser("json"),
    });

    expect.assertions(5);
    try {
      await executor.execute({});
    } catch (error: any) {
      expect(isLlmExeError(error, "parser.parse_failed")).toEqual(true);
      expect(error.context.reason).toEqual("invalid_json");
      expect(error.context.parser).toEqual("json");
      expect(error.context.stopReason).toEqual("length");
      expect(error.context.usage).toEqual(usage);
    }
  });

  it("reports the response's own stopReason when it completed normally", async () => {
    const executor = createLlmExecutor({
      llm: mockLlm("not json", "stop"),
      prompt,
      parser: createParser("json"),
    });

    expect.assertions(1);
    try {
      await executor.execute({});
    } catch (error: any) {
      expect(error.context.stopReason).toEqual("stop");
    }
  });

  it("exposes the context to error hooks", async () => {
    const onError = jest.fn();
    const executor = createLlmExecutor(
      {
        llm: mockLlm('{"a": '),
        prompt,
        parser: createParser("json"),
      },
      { hooks: { onError: [onError] } }
    );

    await expect(executor.execute({})).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);

    const metadata = onError.mock.calls[0][0];
    expect(metadata.error.context.usage).toEqual(usage);
    expect(metadata.error.context.stopReason).toEqual("length");
  });

  it("includes the context in structured error serialization", async () => {
    const executor = createLlmExecutor({
      llm: mockLlm('{"a": '),
      prompt,
      parser: createParser("json"),
    });

    expect.assertions(3);
    try {
      await executor.execute({});
    } catch (error: any) {
      const json = error.toJSON();
      expect(json.code).toEqual("parser.parse_failed");
      expect(json.context.stopReason).toEqual("length");
      expect(json.context.usage.cache_read_input_tokens).toEqual(256);
    }
  });

  it("leaves standalone parser failures without response context", () => {
    const parser = createParser("json");
    expect.assertions(3);
    try {
      parser.parse('{"a": ');
    } catch (error: any) {
      expect(error.context.reason).toEqual("invalid_json");
      expect(error.context.usage).toBeUndefined();
      expect(error.context.stopReason).toBeUndefined();
    }
  });

  it("does not disturb successful parses", async () => {
    const executor = createLlmExecutor({
      llm: mockLlm('{"a": 1}', "stop"),
      prompt,
      parser: createParser("json"),
    });

    await expect(executor.execute({})).resolves.toEqual({ a: 1 });
  });
});
