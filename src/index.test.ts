import * as llmExe from "@/index";

describe("llmExe", () => {
  test("has all exports", () => {
    /**
     * Utilities
     */
    expect(llmExe).toHaveProperty("utils");
    expect(llmExe).toHaveProperty("guards");
    /**
     * Llm
     */
    expect(llmExe).toHaveProperty("useLlm");
    expect(llmExe).toHaveProperty("useLlmConfiguration");
    expect(llmExe).toHaveProperty("createOpenAiCompatibleConfiguration");
    /**
     * Prompt
     */
    expect(llmExe).toHaveProperty("BasePrompt");
    expect(llmExe).toHaveProperty("TextPrompt");
    expect(llmExe).toHaveProperty("ChatPrompt");
    expect(llmExe).toHaveProperty("createPrompt");
    expect(llmExe).toHaveProperty("createChatPrompt");
    /**
     * Parsers
     */
    expect(llmExe).toHaveProperty("BaseParser");
    expect(llmExe).toHaveProperty("CustomParser");
    expect(llmExe).toHaveProperty("OpenAiFunctionParser");
    expect(llmExe).toHaveProperty("createParser");
    expect(llmExe).toHaveProperty("createCustomParser");
    expect(llmExe).toHaveProperty("LlmNativeFunctionParser");
    expect(llmExe).toHaveProperty("LlmFunctionParser");
    /**
     * Core Functions
     */
    expect(llmExe).toHaveProperty("BaseExecutor");
    expect(llmExe).toHaveProperty("createCoreExecutor");
    expect(llmExe).toHaveProperty("createLlmExecutor");
    expect(llmExe).toHaveProperty("createLlmFunctionExecutor");
    expect(llmExe).toHaveProperty("LlmExecutorWithFunctions");
    // is deprecated
    expect(llmExe).toHaveProperty("LlmExecutorOpenAiFunctions");
    /**
     * Callable
     */
    expect(llmExe).toHaveProperty("useExecutors");
    expect(llmExe).toHaveProperty("createCallableExecutor");
    /**
     * Embedding
     */
    expect(llmExe).toHaveProperty("createEmbedding");
    /**
     * State
     */
    expect(llmExe).toHaveProperty("DefaultState");
    expect(llmExe).toHaveProperty("BaseStateItem");
    expect(llmExe).toHaveProperty("DefaultStateItem");
    expect(llmExe).toHaveProperty("createState");
    expect(llmExe).toHaveProperty("createDialogue");
    expect(llmExe).toHaveProperty("createStateItem");
    /**
     * Schema
     */
    expect(llmExe).toHaveProperty("defineSchema");
    /**
     * Handlebars
     */
    expect(llmExe).toHaveProperty("registerHelpers");
    expect(llmExe).toHaveProperty("registerPartials");
    /**
     * Errors
     */
    expect(llmExe).toHaveProperty("LlmExeError");
    expect(llmExe).toHaveProperty("LLM_EXE_ERROR_SYMBOL");
    expect(llmExe).toHaveProperty("isLlmExeError");
    expect(llmExe).toHaveProperty("serializeLlmExeError");
    expect(llmExe).toHaveProperty("formatLlmExeErrorForLog");
  });

  test("exported functions are callable", () => {
    expect(typeof llmExe.useLlm).toBe("function");
    expect(typeof llmExe.useLlmConfiguration).toBe("function");
    expect(typeof llmExe.createOpenAiCompatibleConfiguration).toBe("function");
    expect(typeof llmExe.createPrompt).toBe("function");
    expect(typeof llmExe.createChatPrompt).toBe("function");
    expect(typeof llmExe.createParser).toBe("function");
    expect(typeof llmExe.createCustomParser).toBe("function");
    expect(typeof llmExe.createCoreExecutor).toBe("function");
    expect(typeof llmExe.createLlmExecutor).toBe("function");
    expect(typeof llmExe.createLlmFunctionExecutor).toBe("function");
    expect(typeof llmExe.useExecutors).toBe("function");
    expect(typeof llmExe.createCallableExecutor).toBe("function");
    expect(typeof llmExe.createEmbedding).toBe("function");
    expect(typeof llmExe.createState).toBe("function");
    expect(typeof llmExe.createStateItem).toBe("function");
    expect(typeof llmExe.createDialogue).toBe("function");
    expect(typeof llmExe.defineSchema).toBe("function");
    expect(typeof llmExe.registerHelpers).toBe("function");
    expect(typeof llmExe.registerPartials).toBe("function");
  });

  test("exported classes are constructable", () => {
    expect(typeof llmExe.BasePrompt).toBe("function");
    expect(typeof llmExe.TextPrompt).toBe("function");
    expect(typeof llmExe.ChatPrompt).toBe("function");
    expect(typeof llmExe.BaseParser).toBe("function");
    expect(typeof llmExe.CustomParser).toBe("function");
    expect(typeof llmExe.OpenAiFunctionParser).toBe("function");
    expect(typeof llmExe.LlmNativeFunctionParser).toBe("function");
    expect(typeof llmExe.LlmFunctionParser).toBe("function");
    expect(typeof llmExe.BaseExecutor).toBe("function");
    expect(typeof llmExe.LlmExecutorWithFunctions).toBe("function");
    expect(typeof llmExe.LlmExecutorOpenAiFunctions).toBe("function");
    expect(typeof llmExe.DefaultState).toBe("function");
    expect(typeof llmExe.BaseStateItem).toBe("function");
    expect(typeof llmExe.DefaultStateItem).toBe("function");
  });

  test("utils namespace has expected utilities", () => {
    expect(llmExe.utils).toBeDefined();
    expect(typeof llmExe.utils).toBe("object");
  });

  test("guards namespace has expected guards", () => {
    expect(llmExe.guards).toBeDefined();
    expect(typeof llmExe.guards).toBe("object");
  });

  test("defineSchema returns schema unchanged", () => {
    const schema = {
      type: "object" as const,
      properties: { name: { type: "string" as const } },
    };
    const result = llmExe.defineSchema(schema);
    expect(result).toEqual(schema);
  });

  test("createState returns a state instance", () => {
    const state = llmExe.createState();
    expect(state).toBeInstanceOf(llmExe.DefaultState);
  });

  test("createDialogue returns a dialogue state", () => {
    const dialogue = llmExe.createDialogue("test-dialogue");
    expect(dialogue).toBeDefined();
  });

  test("createParser via index creates correct parser", () => {
    const parser = llmExe.createParser("string");
    expect(parser).toBeInstanceOf(llmExe.BaseParser);
  });

  test("createCustomParser via index creates correct parser", () => {
    const parser = llmExe.createCustomParser("test", (text) => text.toUpperCase());
    expect(parser).toBeInstanceOf(llmExe.CustomParser);
  });

  test("createChatPrompt via index creates correct prompt", () => {
    const prompt = llmExe.createChatPrompt("Test instruction");
    expect(prompt).toBeInstanceOf(llmExe.ChatPrompt);
  });

  test("error helpers are exported and callable from index", () => {
    expect(typeof llmExe.isLlmExeError).toBe("function");
    expect(typeof llmExe.serializeLlmExeError).toBe("function");
    expect(typeof llmExe.formatLlmExeErrorForLog).toBe("function");

    const err = new llmExe.LlmExeError("boom", {
      code: "parser.parse_failed",
    });
    expect(llmExe.isLlmExeError(err)).toBe(true);

    const serialized = llmExe.serializeLlmExeError(err) as {
      name: string;
      message: string;
      code: string;
    };
    expect(serialized).toMatchObject({
      name: "LlmExeError",
      message: "boom",
      code: "parser.parse_failed",
    });

    const formatted = llmExe.formatLlmExeErrorForLog(err);
    expect(formatted).toContain("boom");
    expect(formatted).toContain("parser.parse_failed");
  });
});
