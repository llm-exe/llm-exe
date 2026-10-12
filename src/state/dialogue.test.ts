import { BaseStateItem, Dialogue, createDialogue } from "@/state";
import { IChatUserMessage } from "@/types";
import { assert } from "@/utils/modules/assert";
import { mockOutputResultObject } from "../../utils/mock.helpers";
import { BaseLlmOutput } from "@/llm/output/base";

/**
 * Tests Dialogue
 */
describe("llm-exe:state/Dialogue", () => {
  it("defaults to text dialogue", () => {
    const dialogue = createDialogue("main");
    expect(dialogue).toBeInstanceOf(Dialogue);
    expect(dialogue).toBeInstanceOf(BaseStateItem);
  });

  it("defaults to text dialogue", () => {
    const dialogue = new Dialogue("main");
    expect(dialogue).toBeInstanceOf(Dialogue);
    expect(dialogue).toHaveProperty("name");
    expect(dialogue.name).toEqual("main");
  });
  it("can set user message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setUserMessage("Hello, anybody home?");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].content).toEqual("Hello, anybody home?");
    expect(history[0].role).toEqual("user");
  });
  it("can set user message with name on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setUserMessage("Hello, anybody home?", "Greg");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].content).toEqual("Hello, anybody home?");
    expect(history[0].role).toEqual("user");
    if (history[0].role === "user") {
      expect(history[0]?.name).toEqual("Greg");
    }
  });
  it("does not set empty user message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setUserMessage("");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(0);
  });
  it("can set assistant message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setAssistantMessage("Hello, anybody home?");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].content).toEqual("Hello, anybody home?");
    expect(history[0].role).toEqual("assistant");
  });
  it("does not set assistant user message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setAssistantMessage("");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(0);
  });
  it("can set system message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setSystemMessage("Hello, anybody home?");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].content).toEqual("Hello, anybody home?");
    expect(history[0].role).toEqual("system");
  });
  it("does not set system user message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setSystemMessage("");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(0);
  });

  it("can set function message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setFunctionMessage(`{}`, "test_fn");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].content).toEqual("{}");
    expect(history[0].role).toEqual("function");
    assert(history[0].role === "function");
    expect(history[0].name).toEqual("test_fn");
  });

  it("can set function_call message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setFunctionCallMessage({
      function_call: { name: "test_fn", arguments: '{arg1: "Hello"}' },
    });
    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);

    expect(history[0].role).toEqual("function_call");
    assert(history[0].role === "function_call");
    assert(history[0].content === null);
    expect(history[0].function_call).toEqual({
      name: "test_fn",
      arguments: '{arg1: "Hello"}',
    });
  });

  it("setFunctionMessage is chainable", () => {
    const dialogue = new Dialogue("main");
    expect(dialogue.setFunctionMessage(`{}`, "test_fn")).toBeInstanceOf(
      Dialogue
    );
  });

  it("setFunctionMessage is chainable", () => {
    const dialogue = new Dialogue("main");
    expect(dialogue.setFunctionMessage(`{}`, "test_fn")).toBeInstanceOf(
      Dialogue
    );
  });

  it("can set all messages on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setSystemMessage("This is the system message.");
    dialogue.setUserMessage("This is the user message");
    dialogue.setAssistantMessage("Hello, this is the assistant");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].content).toEqual("This is the system message.");
    expect(history[0].role).toEqual("system");

    expect(history[1].content).toEqual("This is the user message");
    expect(history[1].role).toEqual("user");

    expect(history[2].content).toEqual("Hello, this is the assistant");
    expect(history[2].role).toEqual("assistant");
  });
  it("does not set system user message on state", () => {
    const dialogue = new Dialogue("main");
    dialogue.setMessageTurn("Hi, anyone there?", "Yes! we're always here");
    const history = dialogue.getHistory();
    expect(history).toHaveLength(2);

    expect(history[0].content).toEqual("Hi, anyone there?");
    expect(history[0].role).toEqual("user");

    expect(history[1].content).toEqual("Yes! we're always here");
    expect(history[1].role).toEqual("assistant");
  });
  it("can set multiple messages from history", () => {
    const dialogue = new Dialogue("main");

    dialogue.setHistory([
      {
        role: "user",
        content: "Hello?",
      },
      {
        role: "assistant",
        content: "Hello!!",
      },
      {
        role: "system",
        content: "Stop saying hello",
      },
    ]);

    const history = dialogue.getHistory();
    expect(history).toHaveLength(3);

    expect(history[0].content).toEqual("Hello?");
    expect(history[0].role).toEqual("user");

    expect(history[1].content).toEqual("Hello!!");
    expect(history[1].role).toEqual("assistant");

    expect(history[2].content).toEqual("Stop saying hello");
    expect(history[2].role).toEqual("system");
  });
  it("can set multiple messages from history", () => {
    const dialogue = new Dialogue("main");

    dialogue.setHistory([
      {
        role: "user",
        content: "Hello?",
        name: "Greg",
      },
    ]);

    const history = dialogue.getHistory();
    expect(history).toHaveLength(1);

    expect(history[0].content).toEqual("Hello?");
    expect(history[0].role).toEqual("user");
    expect((history[0] as IChatUserMessage).name).toEqual("Greg");
  });

  it("can set multiple messages with functions from history", () => {
    const dialogue = new Dialogue("main");

    dialogue.setHistory([
      {
        role: "user",
        content: "Hello?",
      },
      {
        role: "function_call",
        content: null,
        function_call: {
          name: "test_fn",
          arguments: "{}",
        },
      },
      {
        role: "function",
        content: "Output",
        name: "test_fn",
      },
      {
        role: "system",
        content: "Stop saying hello",
      },
    ]);

    const history = dialogue.getHistory();
    expect(history).toHaveLength(4);

    expect(history[0].content).toEqual("Hello?");
    expect(history[0].role).toEqual("user");

    expect(history[1].content).toEqual(null);
    expect(history[1].role).toEqual("function_call");
    assert(history[1].role === "function_call");
    expect(history[1].function_call?.name).toEqual("test_fn");
    expect(history[1].function_call?.arguments).toEqual("{}");

    assert(history[2].role === "function");
    expect(history[2].role).toEqual("function");
    expect(history[2].name).toEqual("test_fn");
    expect(history[2].content).toEqual("Output");

    expect(history[3].content).toEqual("Stop saying hello");
    expect(history[3].role).toEqual("system");
  });

  it("can serialize state item", () => {
    const dialogue = new Dialogue("main");
    dialogue.setMessageTurn("Hi, anyone there?", "Yes! we're always here");
    expect(dialogue.serialize()).toEqual({
      class: "Dialogue",
      name: "main",
      value: [
        { role: "user", content: "Hi, anyone there?" },
        { role: "assistant", content: "Yes! we're always here" },
      ],
    });
  });

  describe("OutputResultsText handling", () => {
    it("can set assistant message with OutputResultsText object", () => {
      const dialogue = new Dialogue("main");
      const outputResult = {
        type: "text" as const,
        text: "Hello from output result",
      };
      dialogue.setAssistantMessage(outputResult);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toEqual("Hello from output result");
      expect(history[0].role).toEqual("assistant");
    });
  });

  describe("Tool methods", () => {
    it("setToolCallMessage creates function_call message", () => {
      const dialogue = new Dialogue("main");
      dialogue.setToolCallMessage({
        name: "testTool",
        arguments: '{"param": "value"}',
        id: "tool-123",
      });
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      expect(history[0].function_call).toEqual({
        name: "testTool",
        arguments: '{"param": "value"}',
        id: "tool-123",
      });
    });

    it("setToolCallMessage without id", () => {
      const dialogue = new Dialogue("main");
      dialogue.setToolCallMessage({
        name: "testTool",
        arguments: '{"param": "value"}',
      });
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      expect(history[0].function_call).toEqual({
        name: "testTool",
        arguments: '{"param": "value"}',
        id: undefined,
      });
    });

    it("setToolMessage creates function message", () => {
      const dialogue = new Dialogue("main");
      dialogue.setToolMessage("Tool response", "testTool", "tool-123");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function");
      assert(history[0].role === "function");
      expect(history[0].name).toEqual("testTool");
      expect(history[0].content).toEqual("Tool response");
      expect(history[0].id).toEqual("tool-123");
    });

    it("setToolMessage without id", () => {
      const dialogue = new Dialogue("main");
      dialogue.setToolMessage("Tool response", "testTool");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function");
      assert(history[0].role === "function");
      expect(history[0].name).toEqual("testTool");
      expect(history[0].content).toEqual("Tool response");
      expect(history[0].id).toEqual(undefined);
    });

    it("setToolMessage is chainable", () => {
      const dialogue = new Dialogue("main");
      const result = dialogue.setToolMessage("response", "testTool");
      expect(result).toBe(dialogue);
      expect(result).toBeInstanceOf(Dialogue);
    });

    it("setToolCallMessage is chainable", () => {
      const dialogue = new Dialogue("main");
      const result = dialogue.setToolCallMessage({
        name: "testTool",
        arguments: "{}",
      });
      expect(result).toBe(dialogue);
      expect(result).toBeInstanceOf(Dialogue);
    });

    it("tool methods support fluent chaining", () => {
      const dialogue = new Dialogue("main");
      dialogue
        .setUserMessage("Call a tool")
        .setToolCallMessage({
          name: "myTool",
          arguments: '{"key":"val"}',
          id: "call-1",
        })
        .setToolMessage('{"result":"ok"}', "myTool", "call-1")
        .setAssistantMessage("Done!");

      const history = dialogue.getHistory();
      expect(history).toHaveLength(4);
      expect(history[0].role).toEqual("user");
      expect(history[1].role).toEqual("function_call");
      expect(history[2].role).toEqual("function");
      expect(history[3].role).toEqual("assistant");
    });
  });

  describe("Error handling", () => {
    it("throws error when setFunctionCallMessage called without function_call", () => {
      const dialogue = new Dialogue("main");
      expect(() => {
        dialogue.setFunctionCallMessage(null as any);
      }).toThrow("Invalid arguments");
    });

    it("throws error when setFunctionCallMessage called with invalid input", () => {
      const dialogue = new Dialogue("main");
      expect(() => {
        dialogue.setFunctionCallMessage({ function_call: null as any });
      }).toThrow("Invalid arguments");
    });
  });

  describe("setHistory edge cases", () => {
    it("handles model role as assistant", () => {
      const dialogue = new Dialogue("main");
      dialogue.setHistory([
        {
          role: "model",
          content: "Model response",
        },
      ]);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("assistant");
      expect(history[0].content).toEqual("Model response");
    });

    it("handles unknown role in setHistory", () => {
      const dialogue = new Dialogue("main");
      dialogue.setHistory([
        {
          role: "custom-role" as any,
          content: "Custom content",
        },
      ]);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("custom-role");
      expect(history[0].content).toEqual("Custom content");
    });

    it("handles unknown role with no content in setHistory", () => {
      const dialogue = new Dialogue("main");
      dialogue.setHistory([
        {
          role: "custom-role" as any,
        } as any,
      ]);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("custom-role");
      expect(history[0].content).toEqual("");
    });

    it("handles function_call with id in setHistory", () => {
      const dialogue = new Dialogue("main");
      dialogue.setHistory([
        {
          role: "function_call",
          content: null,
          function_call: {
            name: "testFunc",
            arguments: '{"test": true}',
            id: "func-456",
          },
        },
      ]);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.id).toEqual("func-456");
    });
  });

  describe("Additional coverage", () => {
    it("setUserMessage with detailed content array", () => {
      const dialogue = new Dialogue("main");
      const detailedContent = [
        { type: "text" as const, text: "Hello" },
        {
          type: "image_url" as const,
          image_url: { url: "https://example.com/image.jpg" },
        },
      ];
      dialogue.setUserMessage(detailedContent);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("user");
      expect(history[0].content).toEqual(detailedContent);
    });

    it("setMessageTurn with system message", () => {
      const dialogue = new Dialogue("main");
      dialogue.setMessageTurn("User msg", "Assistant msg", "System msg");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].content).toEqual("System msg");
      expect(history[0].role).toEqual("system");
      expect(history[1].content).toEqual("User msg");
      expect(history[2].content).toEqual("Assistant msg");
    });

    it("does not set function message with empty content", () => {
      const dialogue = new Dialogue("main");
      dialogue.setFunctionMessage("", "test_fn");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(0);
    });

    it("setFunctionMessage with id parameter", () => {
      const dialogue = new Dialogue("main");
      dialogue.setFunctionMessage("Result", "test_fn", "func-789");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function");
      assert(history[0].role === "function");
      expect(history[0].id).toEqual("func-789");
    });

    it("setFunctionCallMessage stringifies object arguments", () => {
      const dialogue = new Dialogue("main");
      dialogue.setFunctionCallMessage({
        function_call: {
          name: "test_fn",
          arguments: { key: "value" } as any,
        },
      });
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.arguments).toEqual('{"key":"value"}');
    });
  });

  describe("add* aliases", () => {
    it("addUserMessage delegates to setUserMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addUserMessage("Hello from add");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("user");
      expect(history[0].content).toEqual("Hello from add");
    });

    it("addUserMessage with name", () => {
      const dialogue = new Dialogue("main");
      dialogue.addUserMessage("Hello", "Greg");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("user");
      assert(history[0].role === "user");
      expect(history[0].name).toEqual("Greg");
    });

    it("addAssistantMessage delegates to setAssistantMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addAssistantMessage("Assistant response");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("assistant");
      expect(history[0].content).toEqual("Assistant response");
    });

    it("addSystemMessage delegates to setSystemMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addSystemMessage("System instruction");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("system");
      expect(history[0].content).toEqual("System instruction");
    });

    it("addToolMessage delegates to setToolMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addToolMessage("Tool output", "myTool", "tool-1");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function");
      assert(history[0].role === "function");
      expect(history[0].name).toEqual("myTool");
      expect(history[0].content).toEqual("Tool output");
      expect(history[0].id).toEqual("tool-1");
    });

    it("addToolMessage accepts content blocks", () => {
      const dialogue = new Dialogue("main");
      const content = [
        { type: "text", text: "here it is" },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
        },
      ];
      dialogue.addToolMessage(content, "myTool", "tool-1");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      assert(history[0].role === "function");
      expect(history[0].content).toEqual(content);
    });

    it("addToolCallMessage delegates to setToolCallMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addToolCallMessage({
        name: "myTool",
        arguments: '{"key":"val"}',
        id: "call-1",
      });
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.name).toEqual("myTool");
    });

    it("addFunctionMessage delegates to setFunctionMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addFunctionMessage("Result", "fn1", "fn-1");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function");
      assert(history[0].role === "function");
      expect(history[0].name).toEqual("fn1");
    });

    it("addFunctionMessage accepts content blocks", () => {
      const dialogue = new Dialogue("main");
      const content = [
        { type: "text", text: "result" },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
        },
      ];
      dialogue.addFunctionMessage(content, "fn1", "fn-1");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      assert(history[0].role === "function");
      expect(history[0].content).toEqual(content);
    });

    it("addFunctionCallMessage delegates to setFunctionCallMessage", () => {
      const dialogue = new Dialogue("main");
      dialogue.addFunctionCallMessage({
        function_call: { name: "fn1", arguments: "{}" },
      });
      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.name).toEqual("fn1");
    });

    it("addMessageTurn delegates to setMessageTurn", () => {
      const dialogue = new Dialogue("main");
      dialogue.addMessageTurn("User msg", "Assistant msg", "System msg");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].role).toEqual("system");
      expect(history[1].role).toEqual("user");
      expect(history[2].role).toEqual("assistant");
    });

    it("addMessageTurn without systemMessage uses default empty string", () => {
      const dialogue = new Dialogue("main");
      dialogue.addMessageTurn("User msg", "Assistant msg");
      const history = dialogue.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toEqual("user");
      expect(history[0].content).toEqual("User msg");
      expect(history[1].role).toEqual("assistant");
      expect(history[1].content).toEqual("Assistant msg");
    });

    it("addHistory delegates to setHistory", () => {
      const dialogue = new Dialogue("main");
      dialogue.addHistory([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ]);
      const history = dialogue.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toEqual("user");
      expect(history[1].role).toEqual("assistant");
    });

    it("add* methods are chainable", () => {
      const dialogue = new Dialogue("main");
      const result = dialogue
        .addSystemMessage("Be helpful")
        .addUserMessage("Hello")
        .addAssistantMessage("Hi there")
        .addToolCallMessage({
          name: "search",
          arguments: '{"q":"test"}',
          id: "c1",
        })
        .addToolMessage("found it", "search", "c1");

      expect(result).toBe(dialogue);
      expect(dialogue.getHistory()).toHaveLength(5);
    });
  });

  describe("addFromOutput", () => {
    it("adds text-only response", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        { type: "text", text: "Hello world" },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("assistant");
      expect(history[0].content).toEqual("Hello world");
    });

    it("adds multiple text content as separate messages", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        { type: "text", text: "Hello" },
        { type: "text", text: " " },
        { type: "text", text: "world" },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].content).toEqual("Hello");
      expect(history[1].content).toEqual(" ");
      expect(history[2].content).toEqual("world");
    });

    it("adds function-only response", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        {
          type: "function_use",
          name: "calculate",
          input: { x: 1, y: 2 },
          functionId: "call-123",
        },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.name).toEqual("calculate");
      expect(history[0].function_call?.arguments).toEqual('{"x":1,"y":2}');
      expect(history[0].function_call?.id).toEqual("call-123");
    });

    it("adds multiple function calls", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        {
          type: "function_use",
          name: "func1",
          input: { a: 1 },
          functionId: "call-1",
        },
        {
          type: "function_use",
          name: "func2",
          input: { b: 2 },
          functionId: "call-2",
        },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toEqual("function_call");
      expect(history[1].role).toEqual("function_call");
      assert(history[0].role === "function_call");
      assert(history[1].role === "function_call");
      expect(history[0].function_call?.name).toEqual("func1");
      expect(history[1].function_call?.name).toEqual("func2");
    });

    it("adds mixed content (text + functions) in order", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        { type: "text", text: "I'll help you with that." },
        {
          type: "function_use",
          name: "search",
          input: { query: "test" },
          functionId: "call-456",
        },
        { type: "text", text: "Let me search for you." },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].role).toEqual("assistant");
      expect(history[0].content).toEqual("I'll help you with that.");
      expect(history[1].role).toEqual("function_call");
      assert(history[1].role === "function_call");
      expect(history[1].function_call?.name).toEqual("search");
      expect(history[2].role).toEqual("assistant");
      expect(history[2].content).toEqual("Let me search for you.");
    });

    it("handles empty content array", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(0);
    });

    it("skips empty text (respects setAssistantMessage behavior)", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([{ type: "text", text: "" }]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(0);
    });

    it("works with BaseLlCall wrapper", () => {
      const dialogue = new Dialogue("main");
      const result = mockOutputResultObject([
        { type: "text", text: "Wrapped response" },
      ]);
      const wrapped = BaseLlmOutput(result);

      dialogue.addFromOutput(wrapped);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toEqual("Wrapped response");
    });

    it("handles function calls with functionId", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        {
          functionId: "call-123",
          type: "function_use",
          name: "test",
          input: { data: "value" },
        },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.id).toEqual("call-123");
    });

    it("handles null/undefined text gracefully", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        { type: "text", text: null as any },
        { type: "text", text: undefined as any },
        { type: "text", text: "Valid text" },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toEqual("Valid text");
    });

    it("stringifies function input objects", () => {
      const dialogue = new Dialogue("main");
      const complexInput = {
        nested: { data: [1, 2, 3] },
        flag: true,
      };
      const output = mockOutputResultObject([
        {
          functionId: "complex-123",
          type: "function_use",
          name: "complex",
          input: complexInput,
        },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(1);
      assert(history[0].role === "function_call");
      expect(history[0].function_call?.arguments).toEqual(
        JSON.stringify(complexInput)
      );
    });

    it("returns dialogue instance for chaining", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([{ type: "text", text: "Test" }]);

      const result = dialogue.addFromOutput(output);

      expect(result).toBe(dialogue);
    });

    it("preserves exact order of mixed content", () => {
      const dialogue = new Dialogue("main");
      const output = mockOutputResultObject([
        { type: "text", text: "First" },
        { type: "function_use", name: "fn1", input: {}, functionId: "fn1-123" },
        { type: "text", text: "Second" },
        { type: "function_use", name: "fn2", input: {}, functionId: "fn2-456" },
      ]);

      dialogue.addFromOutput(output);

      const history = dialogue.getHistory();
      expect(history).toHaveLength(4);
      expect(history[0].role).toEqual("assistant");
      expect(history[0].content).toEqual("First");
      expect(history[1].role).toEqual("function_call");
      assert(history[1].role === "function_call");
      expect(history[1].function_call?.name).toEqual("fn1");
      expect(history[2].role).toEqual("assistant");
      expect(history[2].content).toEqual("Second");
      expect(history[3].role).toEqual("function_call");
      assert(history[3].role === "function_call");
      expect(history[3].function_call?.name).toEqual("fn2");
    });

    it("handles null output gracefully", () => {
      const dialogue = new Dialogue("main");
      const result = dialogue.addFromOutput(null as any);
      
      expect(result).toBe(dialogue); // Should return this
      expect(dialogue.getHistory()).toHaveLength(0); // No messages added
    });

    it("handles non-object output gracefully", () => {
      const dialogue = new Dialogue("main");
      const result = dialogue.addFromOutput("not an object" as any);
      
      expect(result).toBe(dialogue); // Should return this
      expect(dialogue.getHistory()).toHaveLength(0); // No messages added
    });

    it("handles undefined output gracefully", () => {
      const dialogue = new Dialogue("main");
      const result = dialogue.addFromOutput(undefined as any);

      expect(result).toBe(dialogue); // Should return this
      expect(dialogue.getHistory()).toHaveLength(0); // No messages added
    });

    it("handles BaseLlCall wrapper returning invalid result", () => {
      const dialogue = new Dialogue("main");
      // Simulate a BaseLlCall wrapper where getResult() returns null
      const wrappedWithInvalidResult = {
        getResult: () => null,
      };
      const result = dialogue.addFromOutput(wrappedWithInvalidResult as any);

      expect(result).toBe(dialogue);
      expect(dialogue.getHistory()).toHaveLength(0);
    });

    it("handles BaseLlCall wrapper returning non-object result", () => {
      const dialogue = new Dialogue("main");
      const wrappedWithStringResult = {
        getResult: () => "not an object",
      };
      const result = dialogue.addFromOutput(wrappedWithStringResult as any);

      expect(result).toBe(dialogue);
      expect(dialogue.getHistory()).toHaveLength(0);
    });
  });
});
