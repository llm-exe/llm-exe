import { join } from "node:path";
import { loadConfigFromFile, executorFromFile, runFile } from "./fromFile";
import { executorFromConfig, runConfig } from "./assemble";
import { normalizeConfig } from "./normalize";
import { LlmExecutor } from "@/executor/llm";
import { LlmExecutorWithFunctions } from "@/executor/llm-openai-function";

const fixtures = join(__dirname, "__fixtures__");

// Functions/tools in llm-exe are pure schema — { name, description, parameters }.
// A config file can carry them verbatim; what it CANNOT carry is a handler (live
// code). The config layer's job is to deliver the schema to the executor exactly
// as the TypeScript API would; executing a chosen tool is the caller's concern.
describe("config layer — functions (tools)", () => {
  it("loads a tool schema from a config file unchanged", async () => {
    const config = await loadConfigFromFile(join(fixtures, "weather.yml"));
    const functions = (config.executorOptions as any)?.functions;
    expect(Array.isArray(functions)).toBe(true);
    expect(functions).toHaveLength(1);
    expect(functions[0]).toMatchObject({
      name: "get_weather",
      description: "Get the current weather for a city.",
      parameters: { type: "object" },
    });
  });

  it("assembles a function-calling executor when executorOptions.functions is an array", async () => {
    const executor = await executorFromFile(join(fixtures, "weather.yml"));
    expect(executor).toBeInstanceOf(LlmExecutorWithFunctions);
    // still an LlmExecutor — the function executor extends it
    expect(executor).toBeInstanceOf(LlmExecutor);
  });

  it("assembles a plain executor when there are no functions", () => {
    const executor = executorFromConfig(
      normalizeConfig({ provider: "openai.chat-mock.v1", message: "hi" })
    );
    expect(executor).toBeInstanceOf(LlmExecutor);
    expect(executor).not.toBeInstanceOf(LlmExecutorWithFunctions);
  });

  it("delivers functions to the provider request via runConfig (forwarded to .execute)", async () => {
    const config = await loadConfigFromFile(join(fixtures, "weather.yml"));
    const spy = jest
      .spyOn(LlmExecutorWithFunctions.prototype, "execute")
      .mockResolvedValue("mocked" as never);

    await runConfig(config);

    const [, optionsArg] = spy.mock.calls[0];
    expect(optionsArg).toMatchObject({
      functionCall: "auto",
      functions: [{ name: "get_weather" }],
    });
    spy.mockRestore();
  });

  it("runs end-to-end against the mock provider without a handler", async () => {
    // No tool is actually invoked (no handler exists); the mock returns text and
    // the function parser passes it through. This proves the pipeline assembles
    // and runs with a tool schema present.
    const result = await runFile(join(fixtures, "weather.yml"));
    expect(result).toBeDefined();
  });
});
