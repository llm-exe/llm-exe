/**
 * Integration tests using mock scenarios.
 *
 * These tests wire up the full Prompt → LLM → Parser pipeline using
 * mocked LLM responses so we can validate end-to-end behavior without
 * making real API calls.
 */
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";
import { createParser, createCustomParser } from "@/parser";
import { JsonParser } from "@/parser";
import { createLlmExecutor, createCoreExecutor } from "@/executor/_functions";
import { createDialogue, createState } from "@/state";
import { BaseLlmOutput } from "@/llm/output/base";
import { defineSchema } from "@/utils/modules/defineSchema";

import {
  SIMPLE_TEXT,
  TEXT_EMPTY,
  SINGLE_FUNCTION_CALL,
  PARALLEL_FUNCTION_CALLS,
  TEXT_THEN_FUNCTION,
  INTERLEAVED_MIXED,
  HIGH_TOKEN_USAGE,
  RESPONSE_WITH_OPTIONS,
  CONVERSATION_SIMPLE,
  CONVERSATION_WITH_TOOLS,
  CONVERSATION_MULTI_TURN,
  CONVERSATION_PARALLEL_TOOLS,
  TEMPLATE_INPUTS,
  PARSER_INPUTS,
} from "./mock.scenarios";

// ─── BaseLlmOutput wrapper tests ──────────────────────────────────────

describe("Scenario: BaseLlmOutput wrapping", () => {
  it("wraps simple text and exposes getResultText", () => {
    const wrapped = BaseLlmOutput(SIMPLE_TEXT);
    expect(wrapped.getResultText()).toEqual("The capital of France is Paris.");
  });

  it("wraps function call and exposes getResult", () => {
    const wrapped = BaseLlmOutput(SINGLE_FUNCTION_CALL);
    const result = wrapped.getResult();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toEqual("function_use");
    if (result.content[0].type === "function_use") {
      expect(result.content[0].name).toEqual("get_weather");
      expect(result.content[0].input).toEqual({
        location: "San Francisco",
        units: "celsius",
      });
    }
  });

  it("wraps mixed content and preserves order", () => {
    const wrapped = BaseLlmOutput(TEXT_THEN_FUNCTION);
    const result = wrapped.getResult();
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toEqual("text");
    expect(result.content[1].type).toEqual("function_use");
  });

  it("exposes getResultContent for content array access", () => {
    const wrapped = BaseLlmOutput(INTERLEAVED_MIXED);
    const content = wrapped.getResultContent();
    expect(content).toHaveLength(5);
    expect(content[0].type).toEqual("text");
    expect(content[1].type).toEqual("function_use");
    expect(content[2].type).toEqual("text");
    expect(content[3].type).toEqual("function_use");
    expect(content[4].type).toEqual("text");
  });

  it("preserves usage metadata", () => {
    const wrapped = BaseLlmOutput(HIGH_TOKEN_USAGE);
    const result = wrapped.getResult();
    expect(result.usage.input_tokens).toEqual(100000);
    expect(result.usage.total_tokens).toEqual(104096);
  });

  it("preserves options when present", () => {
    const wrapped = BaseLlmOutput(RESPONSE_WITH_OPTIONS);
    const result = wrapped.getResult();
    expect(result.options).toHaveLength(2);
    expect(result.options![0][0]).toEqual({
      type: "text",
      text: "Option B response",
    });
  });
});

// ─── Dialogue + Output integration ────────────────────────────────────

describe("Scenario: Dialogue management", () => {
  describe("building conversations from scratch", () => {
    it("builds a simple Q&A dialogue", () => {
      const dialogue = createDialogue("main");
      dialogue
        .setSystemMessage("You are a helpful assistant.")
        .setUserMessage("What is TypeScript?")
        .setAssistantMessage("TypeScript is a typed superset of JavaScript.");

      const history = dialogue.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].role).toEqual("system");
      expect(history[1].role).toEqual("user");
      expect(history[2].role).toEqual("assistant");
    });

    it("builds a tool-use dialogue", () => {
      const dialogue = createDialogue("tools");
      dialogue
        .setSystemMessage("You are a weather assistant.")
        .setUserMessage("What's the weather in SF?")
        .setFunctionCallMessage({
          name: "get_weather",
          arguments: '{"location":"San Francisco"}',
          id: "call_100",
        })
        .setFunctionMessage(
          '{"temp": 65, "condition": "foggy"}',
          "get_weather",
          "call_100",
        )
        .setAssistantMessage("It's 65°F and foggy in San Francisco.");

      const history = dialogue.getHistory();
      expect(history).toHaveLength(5);
      expect(history[2].role).toEqual("function_call");
      expect(history[3].role).toEqual("function");
    });
  });

  describe("loading from existing history", () => {
    it("loads a simple conversation via setHistory", () => {
      const dialogue = createDialogue("loaded");
      dialogue.setHistory(CONVERSATION_SIMPLE);
      expect(dialogue.getHistory()).toHaveLength(3);
    });

    it("loads a tool conversation via setHistory", () => {
      const dialogue = createDialogue("loaded-tools");
      dialogue.setHistory(CONVERSATION_WITH_TOOLS);
      expect(dialogue.getHistory()).toHaveLength(5);

      const h = dialogue.getHistory();
      expect(h[2].role).toEqual("function_call");
      expect(h[3].role).toEqual("function");
    });

    it("loads multi-turn conversation", () => {
      const dialogue = createDialogue("multi");
      dialogue.setHistory(CONVERSATION_MULTI_TURN);
      expect(dialogue.getHistory()).toHaveLength(6);
    });

    it("loads parallel tool conversation", () => {
      const dialogue = createDialogue("parallel");
      dialogue.setHistory(CONVERSATION_PARALLEL_TOOLS);
      const h = dialogue.getHistory();
      expect(h).toHaveLength(7);
      // Two consecutive function_call messages
      expect(h[2].role).toEqual("function_call");
      expect(h[3].role).toEqual("function_call");
    });
  });

  describe("addFromOutput integration", () => {
    it("adds simple text from OutputResult", () => {
      const dialogue = createDialogue("output");
      dialogue.setUserMessage("Hello");
      dialogue.addFromOutput(SIMPLE_TEXT);

      const h = dialogue.getHistory();
      expect(h).toHaveLength(2);
      expect(h[1].role).toEqual("assistant");
      expect(h[1].content).toEqual("The capital of France is Paris.");
    });

    it("adds function call from OutputResult", () => {
      const dialogue = createDialogue("output-fn");
      dialogue.setUserMessage("What's the weather?");
      dialogue.addFromOutput(SINGLE_FUNCTION_CALL);

      const h = dialogue.getHistory();
      expect(h).toHaveLength(2);
      expect(h[1].role).toEqual("function_call");
    });

    it("adds mixed content preserving order", () => {
      const dialogue = createDialogue("output-mixed");
      dialogue.setUserMessage("Help me with two tasks.");
      dialogue.addFromOutput(INTERLEAVED_MIXED);

      const h = dialogue.getHistory();
      expect(h).toHaveLength(6); // 1 user + 5 from output
      expect(h[1].role).toEqual("assistant");
      expect(h[2].role).toEqual("function_call");
      expect(h[3].role).toEqual("assistant");
      expect(h[4].role).toEqual("function_call");
      expect(h[5].role).toEqual("assistant");
    });

    it("adds from wrapped BaseLlmOutput", () => {
      const dialogue = createDialogue("wrapped");
      const wrapped = BaseLlmOutput(TEXT_THEN_FUNCTION);
      dialogue.addFromOutput(wrapped);

      const h = dialogue.getHistory();
      expect(h).toHaveLength(2);
      expect(h[0].role).toEqual("assistant");
      expect(h[1].role).toEqual("function_call");
    });

    it("handles empty text in output (skips it)", () => {
      const dialogue = createDialogue("empty");
      dialogue.addFromOutput(TEXT_EMPTY);
      expect(dialogue.getHistory()).toHaveLength(0);
    });

    it("builds full agentic loop", () => {
      const dialogue = createDialogue("agent-loop");

      // Turn 1: User asks
      dialogue.setSystemMessage("You are a weather bot.");
      dialogue.setUserMessage("What's the weather in SF and NYC?");

      // Turn 2: LLM responds with tool calls
      dialogue.addFromOutput(PARALLEL_FUNCTION_CALLS);

      // Turn 3: Tool results come back
      dialogue.setFunctionMessage(
        '{"temp": 65, "condition": "foggy"}',
        "get_weather",
        "call_001",
      );
      dialogue.setFunctionMessage(
        '{"temp": 45, "condition": "clear"}',
        "get_weather",
        "call_002",
      );

      // Turn 4: LLM summarizes
      dialogue.addFromOutput(SIMPLE_TEXT);

      const h = dialogue.getHistory();
      expect(h).toHaveLength(7);
      expect(h[0].role).toEqual("system");
      expect(h[1].role).toEqual("user");
      expect(h[2].role).toEqual("function_call");
      expect(h[3].role).toEqual("function_call");
      expect(h[4].role).toEqual("function");
      expect(h[5].role).toEqual("function");
      expect(h[6].role).toEqual("assistant");
    });
  });

  describe("serialization", () => {
    it("serializes and can rebuild from serialized data", () => {
      const dialogue = createDialogue("serial");
      dialogue.setHistory(CONVERSATION_WITH_TOOLS);

      const serialized = dialogue.serialize();
      expect(serialized.class).toEqual("Dialogue");
      expect(serialized.name).toEqual("serial");
      expect(serialized.value).toHaveLength(5);

      // Rebuild from serialized
      const rebuilt = createDialogue("serial-rebuilt");
      rebuilt.setHistory(serialized.value);
      expect(rebuilt.getHistory()).toHaveLength(5);
    });
  });
});

// ─── State management ─────────────────────────────────────────────────

describe("Scenario: State with dialogues", () => {
  it("manages multiple dialogues in a single state", () => {
    const state = createState();
    const main = state.createDialogue("main");
    const side = state.createDialogue("side-channel");

    main.setSystemMessage("Main conversation");
    main.setUserMessage("Hello main");

    side.setSystemMessage("Side conversation");
    side.setUserMessage("Hello side");

    expect(state.getDialogue("main").getHistory()).toHaveLength(2);
    expect(state.getDialogue("side-channel").getHistory()).toHaveLength(2);
  });

  it("useDialogue retrieves or creates", () => {
    const state = createState();
    const d1 = state.useDialogue("auto");
    d1.setUserMessage("First");

    const d2 = state.useDialogue("auto");
    expect(d2.getHistory()).toHaveLength(1);
    expect(d2.getHistory()[0].content).toEqual("First");
  });
});

// ─── Parser scenarios ─────────────────────────────────────────────────

describe("Scenario: Parser with mock outputs", () => {
  it("StringParser extracts text from output", () => {
    const parser = createParser("string");
    const result = parser.parse("The capital of France is Paris.");
    expect(result).toEqual("The capital of France is Paris.");
  });

  it("JsonParser parses valid JSON text", () => {
    const parser = createParser("json");
    const result = parser.parse(PARSER_INPUTS.validJson);
    expect(result).toEqual({ key: "value", count: 42 });
  });

  it("JsonParser with schema validates output", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        key: { type: "string" },
        count: { type: "number" },
      },
      required: ["key", "count"],
    });
    const parser = new JsonParser({ schema });
    const result = parser.parse(PARSER_INPUTS.validJson);
    expect(result).toEqual({ key: "value", count: 42 });
  });

  it("NumberParser extracts number", () => {
    const parser = createParser("number");
    expect(parser.parse(PARSER_INPUTS.number)).toEqual(42);
  });

  it("BooleanParser parses boolean tokens", () => {
    const parser = createParser("boolean");
    expect(parser.parse(PARSER_INPUTS.booleanTrue)).toEqual(true);
    expect(parser.parse(PARSER_INPUTS.booleanFalse)).toEqual(false);
  });

  it("ListToArrayParser splits list", () => {
    const parser = createParser("listToArray");
    const result = parser.parse(PARSER_INPUTS.bulletList);
    expect(result).toEqual(["First item", "Second item", "Third item"]);
  });

  it("ListToKeyValueParser splits key-value pairs", () => {
    const parser = createParser("listToKeyValue");
    const result = parser.parse(PARSER_INPUTS.keyValueList);
    // NOTE: Returns array of {key, value} objects, not a flat object.
    expect(result).toEqual([
      { key: "name", value: "Alice" },
      { key: "age", value: "30" },
      { key: "role", value: "engineer" },
    ]);
  });

  it("MarkdownCodeBlockParser extracts code", () => {
    const parser = createParser("markdownCodeBlock");
    const result = parser.parse('```python\nprint("hello")\n```');
    expect(result).toEqual({
      language: "python",
      code: 'print("hello")\n',
    });
  });

  it("CustomParser applies custom logic", () => {
    const parser = createCustomParser("upper", (input: string) =>
      input.toUpperCase(),
    );
    expect(parser.parse("hello world", {} as any)).toEqual("HELLO WORLD");
  });
});

// ─── Prompt template scenarios ────────────────────────────────────────

describe("Scenario: ChatPrompt templates", () => {
  it("renders system message with template variables", () => {
    const prompt = createChatPrompt(
      "You are helping {{name}} with their question.",
    );
    const messages = prompt.format(TEMPLATE_INPUTS.simple);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual(
      "You are helping Alice with their question.",
    );
  });

  it("renders with nested object access", () => {
    const prompt = createChatPrompt(
      "Respond in {{user.preferences.language}} with a {{user.preferences.tone}} tone.",
    );
    const messages = prompt.format(TEMPLATE_INPUTS.withNested);
    expect(messages[0].content).toEqual("Respond in en with a formal tone.");
  });

  it("renders with each helper for arrays", () => {
    const prompt = createChatPrompt(
      "Items: {{#each items}}{{this}}, {{/each}}",
    );
    const messages = prompt.format(TEMPLATE_INPUTS.withArray);
    expect(messages[0].content).toContain("apple");
    expect(messages[0].content).toContain("banana");
    expect(messages[0].content).toContain("cherry");
  });

  it("handles special characters in input", () => {
    const prompt = createChatPrompt("User said: {{{input}}}");
    const messages = prompt.format(TEMPLATE_INPUTS.withSpecialChars);
    expect(messages[0].content).toContain('"Hello <world>');
  });

  it("handles empty input object", () => {
    const prompt = createChatPrompt("Static system message.");
    const messages = prompt.format(TEMPLATE_INPUTS.empty);
    expect(messages[0].content).toEqual("Static system message.");
  });
});

// ─── Executor with mock LLM ──────────────────────────────────────────

describe("Scenario: LlmExecutor with mock LLM", () => {
  const llm = useLlm("openai.chat-mock.v1", { model: "mock" });

  it("executes simple text prompt and returns string", async () => {
    const prompt = createChatPrompt("Say hello.");
    const executor = createLlmExecutor({ llm, prompt });
    const result = await executor.execute({});
    expect(typeof result).toEqual("string");
    expect(result).toContain("Hello world from LLM!");
  });

  it("executes with template variables", async () => {
    const prompt = createChatPrompt("Tell me about {{topic}}.");
    const executor = createLlmExecutor({ llm, prompt });
    const result = await executor.execute({ topic: "TypeScript" });
    expect(result).toContain("TypeScript");
  });

  it("executor tracks execution count", async () => {
    const prompt = createChatPrompt("Test prompt.");
    const executor = createLlmExecutor({ llm, prompt });

    expect(executor.executions).toEqual(0);
    await executor.execute({});
    expect(executor.executions).toEqual(1);
    await executor.execute({});
    expect(executor.executions).toEqual(2);
  });

  it("executor fires hooks on success", async () => {
    const prompt = createChatPrompt("Test prompt.");
    const onSuccess = jest.fn();
    const onComplete = jest.fn();
    const executor = createLlmExecutor(
      { llm, prompt },
      { hooks: { onSuccess, onComplete } },
    );

    await executor.execute({});

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("executor fires onError hook on failure", async () => {
    const onError = jest.fn();
    const onComplete = jest.fn();

    const executor = createLlmExecutor(
      { llm, prompt: undefined as any },
      { hooks: { onError, onComplete } },
    );

    await expect(executor.execute({})).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// ─── CoreExecutor scenarios ───────────────────────────────────────────

describe("Scenario: CoreExecutor for non-LLM handlers", () => {
  it("wraps a sync handler", async () => {
    const executor = createCoreExecutor(
      (input: { x: number; y: number }) => input.x + input.y,
    );
    const result = await executor.execute({ x: 3, y: 4 });
    expect(result).toEqual(7);
  });

  it("wraps an async handler", async () => {
    const executor = createCoreExecutor(async (input: { query: string }) => {
      return { results: [`Found: ${input.query}`] };
    });
    const result = await executor.execute({ query: "test" });
    expect(result).toEqual({ results: ["Found: test"] });
  });

  it("handles errors in handler", async () => {
    const executor = createCoreExecutor(() => {
      throw new Error("Handler failed");
    });
    await expect(executor.execute({})).rejects.toThrow("Handler failed");
  });
});

// ─── Full pipeline scenario ───────────────────────────────────────────

describe("Scenario: Full pipeline with dialogue state", () => {
  it("maintains conversation across multiple executor calls", async () => {
    const llm = useLlm("openai.chat-mock.v1", { model: "mock" });
    const state = createState();
    const dialogue = state.createDialogue("main");

    // First turn
    dialogue.setSystemMessage("You are a helpful assistant.");
    dialogue.setUserMessage("What is 2+2?");

    const prompt1 = createChatPrompt("Answer: {{question}}");
    const executor = createLlmExecutor({ llm, prompt: prompt1 });
    const answer1 = await executor.execute({ question: "What is 2+2?" });

    dialogue.setAssistantMessage(answer1);
    expect(dialogue.getHistory()).toHaveLength(3);

    // Second turn
    dialogue.setUserMessage("And 3+3?");
    const answer2 = await executor.execute({ question: "And 3+3?" });
    dialogue.setAssistantMessage(answer2);

    expect(dialogue.getHistory()).toHaveLength(5);
    expect(dialogue.getHistory()[3].role).toEqual("user");
    expect(dialogue.getHistory()[4].role).toEqual("assistant");
  });
});
