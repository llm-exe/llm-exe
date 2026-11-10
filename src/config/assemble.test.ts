import {
  executorFromConfig,
  loadExecutorConfig,
  runConfig,
} from "./assemble";
import { normalizeConfig } from "./normalize";
import { LlmExecutor } from "@/executor/llm";
import { LlmExecutorWithFunctions } from "@/executor/llm-openai-function";

const config = normalizeConfig({
  provider: "openai.chat-mock.v1",
  system: "You are a helpful summarizer.",
  message: "Summarize: {{text}}",
  parser: "string",
  data: { text: "hello world" },
});

describe("loadExecutorConfig", () => {
  it("normalizes an object (alias of normalizeConfig)", () => {
    const result = loadExecutorConfig({
      provider: "openai.chat-mock.v1",
      message: "hi",
    });
    expect(result.parser).toBe("string");
  });
});

describe("executorFromConfig", () => {
  it("returns a native LlmExecutor for the standard branch", () => {
    expect(executorFromConfig(config)).toBeInstanceOf(LlmExecutor);
  });

  it("returns LlmExecutorWithFunctions when executorOptions.functions is an array", () => {
    const fnConfig = normalizeConfig({
      provider: "openai.chat-mock.v1",
      message: "do it",
      executorOptions: { functions: [] },
    });
    expect(executorFromConfig(fnConfig)).toBeInstanceOf(
      LlmExecutorWithFunctions
    );
  });

  it("does NOT bind config.data — caller supplies input per call", async () => {
    const executor = executorFromConfig(config);
    const result = await executor.execute({ text: "explicit input" });
    expect(typeof result).toBe("string");
    expect(result as unknown as string).toContain("explicit input");
  });

  it("forwards createOptions (hooks) to construction", async () => {
    const onComplete = jest.fn();
    const executor = executorFromConfig(config, { hooks: { onComplete } });
    await executor.execute({ text: "hi" });
    expect(onComplete).toHaveBeenCalled();
  });
});

describe("runConfig", () => {
  afterEach(() => jest.restoreAllMocks());

  it("binds config.data and runs once against the mock provider", async () => {
    const result = await runConfig(config);
    expect(typeof result).toBe("string");
    expect(result as string).toContain("hello world");
  });

  it("forwards executorOptions to .execute() (NOT construction)", async () => {
    const spy = jest
      .spyOn(LlmExecutor.prototype, "execute")
      .mockResolvedValue("mocked" as never);

    await runConfig(
      config,
      { data: { text: "x" }, executorOptions: { temperature: 0.5 } }
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const [dataArg, optionsArg] = spy.mock.calls[0];
    expect(dataArg).toEqual({ text: "x" }); // deep-merged over config.data
    expect(optionsArg).toEqual({ temperature: 0.5 }); // shallow-merged executorOptions
  });

  it("deep-merges overrides.data over config.data", async () => {
    const spy = jest
      .spyOn(LlmExecutor.prototype, "execute")
      .mockResolvedValue("mocked" as never);

    await runConfig(config, { data: { extra: 1 } });

    const [dataArg] = spy.mock.calls[0];
    expect(dataArg).toEqual({ text: "hello world", extra: 1 });
  });

  it("forwards config.executorOptions.functions to execute (the function path)", async () => {
    const functions = [{ name: "noop" }];
    const fnConfig = normalizeConfig({
      provider: "openai.chat-mock.v1",
      message: "do it",
      executorOptions: { functions },
    });
    const spy = jest
      .spyOn(LlmExecutorWithFunctions.prototype, "execute")
      .mockResolvedValue("mocked" as never);

    await runConfig(fnConfig);

    const [, optionsArg] = spy.mock.calls[0];
    expect(optionsArg).toMatchObject({ functions });
  });
});
