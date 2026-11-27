import { join } from "node:path";
import {
  loadConfigFromFile,
  executorFromFile,
  runFile,
} from "./fromFile";
import { LlmExecutor } from "@/executor/llm";

const fixtures = join(__dirname, "__fixtures__");
const expected = {
  provider: "openai.chat-mock.v1",
  system: "You are a helpful summarizer.",
  message: "Summarize: {{text}}",
  parser: "string",
  data: { text: "hello world" },
};

describe("loadConfigFromFile — format parity", () => {
  it.each(["summarize.json", "summarize.yml", "summarize.md"])(
    "normalizes %s to the identical config",
    async (file) => {
      const result = await loadConfigFromFile(join(fixtures, file));
      expect(result).toEqual(expected);
    }
  );

  it("throws configuration.file_not_found for a missing path", async () => {
    await expect(
      loadConfigFromFile(join(fixtures, "does-not-exist.json"))
    ).rejects.toMatchObject({ code: "configuration.file_not_found" });
  });

  it("applies a patch over the file config", async () => {
    const result = await loadConfigFromFile(join(fixtures, "summarize.json"), {
      model: "patched",
    });
    expect(result.model).toBe("patched");
  });
});

describe("executorFromFile", () => {
  it("returns a native executor from a file", async () => {
    const executor = await executorFromFile(join(fixtures, "summarize.yml"));
    expect(executor).toBeInstanceOf(LlmExecutor);
  });
});

describe("runFile", () => {
  it("runs a config file once against the mock provider", async () => {
    const result = await runFile(join(fixtures, "summarize.md"));
    expect(typeof result).toBe("string");
    expect(result as string).toContain("hello world");
  });
});
