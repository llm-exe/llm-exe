import { BaseParser, BaseParserWithJson } from "./_base";
import { defineSchema } from "@/utils/modules/defineSchema";
import { JSONSchema } from "json-schema-to-ts";

/**
 * Concrete implementation for testing the abstract BaseParser
 */
class TestParser extends BaseParser<string> {
  parse(text: string): string {
    return typeof text === "string" ? text : "";
  }
}

class TestParserWithTarget extends BaseParser<string> {
  constructor(name: string, target: "text" | "function_call") {
    super(name, target);
  }
  parse(text: string): string {
    return text;
  }
}

/**
 * Concrete implementation for testing the abstract BaseParserWithJson
 */
class TestJsonParser<S extends JSONSchema | undefined = undefined> extends BaseParserWithJson<S> {
  parse(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}

describe("llm-exe:parser/BaseParser", () => {
  it("sets name from constructor", () => {
    const parser = new TestParser("test-parser");
    expect(parser.name).toBe("test-parser");
  });

  it("sets default target to text", () => {
    const parser = new TestParser("test-parser");
    expect(parser.target).toBe("text");
  });

  it("accepts custom target", () => {
    const parser = new TestParserWithTarget("fn-parser", "function_call");
    expect(parser.target).toBe("function_call");
  });

  it("calls parse method on concrete implementation", () => {
    const parser = new TestParser("test-parser");
    expect(parser.parse("hello world")).toBe("hello world");
  });
});

describe("llm-exe:parser/BaseParserWithJson", () => {
  it("sets schema from options", () => {
    const schema = defineSchema({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    } as const);
    const parser = new TestJsonParser("json-parser", { schema });
    expect(parser.schema).toEqual(schema);
  });

  it("sets validateSchema to true when provided", () => {
    const schema = defineSchema({
      type: "object",
      properties: { name: { type: "string" } },
    } as const);
    const parser = new TestJsonParser("json-parser", {
      schema,
      validateSchema: true,
    });
    expect(parser.validateSchema).toBe(true);
  });

  it("sets validateSchema to false by default", () => {
    const schema = defineSchema({
      type: "object",
      properties: {},
    } as const);
    const parser = new TestJsonParser("json-parser", { schema });
    expect(parser.validateSchema).toBe(false);
  });

  it("handles undefined schema", () => {
    const parser = new TestJsonParser("json-parser", {} as any);
    expect(parser.schema).toBeUndefined();
  });

  it("inherits name from BaseParser", () => {
    const schema = defineSchema({
      type: "object",
      properties: {},
    } as const);
    const parser = new TestJsonParser("my-json-parser", { schema });
    expect(parser.name).toBe("my-json-parser");
  });

  it("calls parse on concrete implementation", () => {
    const schema = defineSchema({
      type: "object",
      properties: { value: { type: "number" } },
    } as const);
    const parser = new TestJsonParser("json-parser", { schema });
    expect(parser.parse('{"value": 42}')).toEqual({ value: 42 });
  });

  it("handles invalid JSON gracefully in concrete parser", () => {
    const parser = new TestJsonParser("json-parser", {} as any);
    expect(parser.parse("not json")).toEqual({});
  });
});
