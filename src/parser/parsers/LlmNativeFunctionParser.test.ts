import {
  BaseParser,
  LlmNativeFunctionParser,
  OpenAiFunctionParser,
  StringParser,
  JsonParser,
} from "@/parser";
import { LlmFunctionParser } from "./LlmNativeFunctionParser";
import { OutputResult } from "@/interfaces";
import { mockOutputResultObject } from "../../../utils/mock.helpers";

/**
 * Tests the LlmFunctionParser class
 */
describe("llm-exe:parser/LlmFunctionParser", () => {
  it("creates class with expected properties", () => {
    const parser = new LlmFunctionParser({ parser: new StringParser() });
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(LlmFunctionParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("functionCall");
    expect(parser).toHaveProperty("target");
    expect(parser.target).toEqual("function_call");
  });

  describe("parse method", () => {
    it("handles string input by delegating to inner parser", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      expect(parser.parse("Hello world" as any)).toEqual("Hello world");
    });

    it("handles OutputResult with undefined content", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      const mockResult = {
        id: "123",
        created: 123,
        stopReason: "STOP",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
        // content is undefined
      };
      expect(() => {
        parser.parse(mockResult as any);
      }).toThrow();
    });

    it("returns content array when function_use is present", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      const content = [
        {
          type: "function_use" as const,
          name: "test_function",
          input: { key: "value" },
          functionId: "test-123",
        },
      ];
      const result = parser.parse(mockOutputResultObject(content));
      expect(result).toEqual(content);
    });

    it("parses text content when no function_use", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      const result = parser.parse(
        mockOutputResultObject([{ text: "Hello", type: "text" }])
      );
      expect(result).toEqual("Hello");
    });

    it("returns all content when mixed types with function_use", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      const content = [
        { type: "text" as const, text: "Processing..." },
        {
          functionId: "calc-789",
          type: "function_use" as const,
          name: "calculate",
          input: { x: 1, y: 2 },
        },
        { type: "text" as const, text: "Done!" },
      ];
      const result = parser.parse(mockOutputResultObject(content));
      expect(result).toEqual(content);
    });

    it("handles empty content array", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      expect(() => {
        parser.parse(mockOutputResultObject([]));
      }).toThrow();
    });

    it("handles content with undefined text", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      expect(() => {
        parser.parse(
          mockOutputResultObject([{ type: "text", text: undefined as any }])
        );
      }).toThrow("Invalid input. Expected string. Received undefined.");
    });

    it("works with JSON parser", () => {
      const parser = new LlmFunctionParser({ parser: new JsonParser() });
      const result = parser.parse(
        mockOutputResultObject([{ text: '{"key": "value"}', type: "text" }])
      );
      expect(result).toEqual({ key: "value" });
    });

    it("handles OutputResult with no content property", () => {
      const parser = new LlmFunctionParser({ parser: new StringParser() });
      const resultWithoutContent = {
        id: "123",
        created: 123,
        stopReason: "STOP",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
        // content property is missing/undefined
      } as OutputResult;

      // When content is undefined, content?.filter returns undefined,
      // triggering the || [] fallback to return an empty array
      // Then functionUses.length === 0, so it tries to access content[0]
      // which will be undefined, causing an error when accessing item.text
      expect(() => {
        parser.parse(resultWithoutContent);
      }).toThrow();
    });
  });
});

/**
 * Tests the LlmNativeFunctionParser class (deprecated)
 */
describe("llm-exe:parser/LlmNativeFunctionParser", () => {
  it("creates class with expected properties", () => {
    const parser = new LlmNativeFunctionParser({ parser: new StringParser() });
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(LlmNativeFunctionParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("openAiFunction");
    expect(parser).toHaveProperty("target");
    expect(parser.target).toEqual("function_call");
  });

  describe("parse method", () => {
    it("handles OutputResult with undefined content", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const mockResult = {
        id: "123",
        created: 123,
        stopReason: "STOP",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
        // content is undefined
      };
      expect(() => {
        parser.parse(mockResult as any);
      }).toThrow("Invalid input. Expected string. Received undefined.");
    });
    it("returns function call object when function_use is present", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse(
        mockOutputResultObject([
          {
            functionId: "test-func-123",
            type: "function_use",
            name: "test_function",
            input: { key: "value" },
          },
        ])
      );
      expect(result).toEqual({
        name: "test_function",
        arguments: { key: "value" },
      });
    });

    it("handles function_use with JSON string input", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse(
        mockOutputResultObject([
          {
            functionId: "json-func-456",
            type: "function_use",
            name: "test_function",
            input: '{"key": "value"}' as any,
          },
        ])
      );
      expect(result).toEqual({
        name: "test_function",
        arguments: { key: "value" },
      });
    });

    it("handles function_use with invalid JSON string", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse(
        mockOutputResultObject([
          {
            functionId: "invalid-json-789",
            type: "function_use",
            name: "test_function",
            input: "not valid json" as any,
          },
        ])
      );
      expect(result).toEqual({
        name: "test_function",
        arguments: {}, // maybeParseJSON returns empty object for invalid JSON
      });
    });

    it("parses text content when no function_use", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse(
        mockOutputResultObject([{ text: "Hello", type: "text" }])
      );
      expect(result).toEqual("Hello");
    });

    it("returns first function_use when multiple are present", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse(
        mockOutputResultObject([
          {
            functionId: "first-func-111",
            type: "function_use",
            name: "first_function",
            input: { first: true },
          },
          {
            functionId: "second-func-222",
            type: "function_use",
            name: "second_function",
            input: { second: true },
          },
        ])
      );
      expect(result).toEqual({
        name: "first_function",
        arguments: { first: true },
      });
    });

    it("handles mixed content types without function_use", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse(
        mockOutputResultObject([
          { type: "text", text: "Hello" },
          { type: "text", text: " world" },
        ])
      );
      // It uses text.text ?? text fallback
      expect(result).toEqual("Hello");
    });

    it("handles object with text property fallback", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const inputObj = {
        text: "fallback text",
        content: [{ type: "text" as const, text: "content text" }],
      } as any;
      const result = parser.parse(inputObj);
      expect(result).toEqual("fallback text");
    });

    it("handles raw string fallback", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const result = parser.parse("raw string" as any);
      expect(result).toEqual("raw string");
    });

    it("ignores function_use without required properties", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const mockResult = mockOutputResultObject([
        {
          type: "function_use",
          name: "test_function",
          // missing input property
        } as any,
        { type: "text", text: "fallback" },
      ]);
      const result = parser.parse(mockResult);
      expect(result).toEqual("fallback");
    });

    it("works with JSON parser", () => {
      const parser = new LlmNativeFunctionParser({ parser: new JsonParser() });
      const mockResult = mockOutputResultObject([
        { text: '{"result": "success"}', type: "text" },
      ]);
      const result = parser.parse(mockResult);
      expect(result).toEqual({ result: "success" });
    });

    it("handles OutputResult with no content property", () => {
      const parser = new LlmNativeFunctionParser({
        parser: new StringParser(),
      });
      const resultWithoutContent = {
        id: "123",
        created: 123,
        stopReason: "STOP",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
        // content property is missing/undefined
      } as OutputResult;

      expect(() => {
        parser.parse(resultWithoutContent);
      }).toThrow();
    });
  });
});

// Test the deprecated export
describe("OpenAiFunctionParser export", () => {
  it("OpenAiFunctionParser is alias for LlmNativeFunctionParser", () => {
    expect(OpenAiFunctionParser).toBe(LlmNativeFunctionParser);
  });
});
