import { BaseParser } from "@/parser";
import { maybeParseJSON } from "@/utils";

/**
 * Tests the BaseParser class
 */
describe("llm-exe:parser/BaseParser", () => {
  class MockParser<T extends { name: string; age: number }> extends BaseParser {
    constructor() {
      super("mock-parser");
    }

    parse(text: string, _attributes?: T) {
      const parsed = maybeParseJSON(text);
      return parsed;
    }
  }
  it("creates class with expected properties", () => {
    const parser = new MockParser();
    expect(parser).toBeInstanceOf(MockParser);
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("mock-parser");
  });
  it("parses simple string correctly", () => {
    const parser = new MockParser();
    expect(parser.parse(JSON.stringify({ age: 90, name: "Greg" }))).toEqual({
      age: 90,
      name: "Greg",
    });
  });

  it("defaults target to text", () => {
    const parser = new MockParser();
    expect(parser.target).toEqual("text");
  });
});

describe("llm-exe:parser/BaseParser with target", () => {
  class FunctionCallParser extends BaseParser {
    constructor() {
      super("fn-parser", "function_call");
    }
    parse(text: string) {
      return text;
    }
  }

  it("sets target to function_call when specified", () => {
    const parser = new FunctionCallParser();
    expect(parser.target).toEqual("function_call");
    expect(parser.name).toEqual("fn-parser");
  });
});
