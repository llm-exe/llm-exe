import {
  LlmExecutorWithFunctions,
  LlmExecutorOpenAiFunctions,
} from "@/executor";
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";

/**
 * `LlmExecutorWithFunctions` adds exactly two things to `LlmExecutor`: it
 * wraps the configured parser in `LlmFunctionParser`, and its `execute`
 * override narrows the options type and forwards them on. The wrapping is
 * covered (`executor-composition.test.ts`, `LlmNativeFunctionParser.test.ts`);
 * the forwarding was not.
 *
 * Nothing in the suite failed when `execute` was mutated to
 * `super.execute(_input)` — the tool definitions would silently never reach
 * the provider and every assertion still passed, because the existing tests
 * either mock `handler` (so options are moot) or only assert that `execute`
 * resolves. These tests pin the hand-off at both boundaries: executor ->
 * handler, and handler -> `llm.call`.
 */
const executors = [
  ["LlmExecutorWithFunctions", LlmExecutorWithFunctions],
  ["LlmExecutorOpenAiFunctions (deprecated)", LlmExecutorOpenAiFunctions],
] as const;

describe.each(executors)(
  "llm-exe:executor/%s forwards function options",
  (_name, Executor) => {
    const originalWarn = console.warn;
    beforeEach(() => {
      // the deprecated executor warns on construction
      console.warn = jest.fn();
    });
    afterEach(() => {
      console.warn = originalWarn;
    });

    const prompt = createChatPrompt("Call a tool.");

    const functions = [
      {
        name: "get_weather",
        description: "Get the weather for a city",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    ];

    it("passes functionCall and functions through to llm.call", async () => {
      const llm = useLlm("openai.chat-mock.v1", { model: "mock" });
      const call = jest.spyOn(llm, "call");

      const executor = new Executor({ llm, prompt });
      await executor.execute({}, { functionCall: "auto", functions });

      expect(call).toHaveBeenCalledTimes(1);
      expect(call.mock.calls[0][1]).toEqual(
        expect.objectContaining({ functionCall: "auto", functions })
      );
    });

    it("passes a named functionCall through to llm.call", async () => {
      const llm = useLlm("openai.chat-mock.v1", { model: "mock" });
      const call = jest.spyOn(llm, "call");

      const executor = new Executor({ llm, prompt });
      await executor.execute(
        {},
        { functionCall: { name: "get_weather" }, functions }
      );

      expect(call.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          functionCall: { name: "get_weather" },
          functions,
        })
      );
    });

    it("reaches the handler with the options intact", async () => {
      const llm = useLlm("openai.chat-mock.v1", { model: "mock" });
      const executor = new Executor({ llm, prompt });
      const handler = jest.spyOn(executor, "handler");

      await executor.execute({}, { functionCall: "none", functions });

      expect(handler).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ functionCall: "none", functions }),
        expect.anything()
      );
    });
  }
);
