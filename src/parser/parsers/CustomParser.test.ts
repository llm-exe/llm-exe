import { BaseParser, CustomParser, createCustomParser } from "@/parser";

describe("llm-exe:parser/CustomParser", () => {
  it("can create custom parser with constructor", () => {
    const parser = new CustomParser("custom-parser-name", (text, _input) => {
      return text.replace("old", "new");
    });
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("custom-parser-name");
  });
  it("can create custom parser with createCustomParser", () => {
    const parser = createCustomParser("custom-parser-name", (text, _input) => {
      return text.replace("old", "new");
    });
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("custom-parser-name");
  });
  it("custom parser returns result", () => {
    const parser = new CustomParser("custom-parser-name", (text, _input) => {
      return text.replace("old", "new");
    });
    expect(parser.parse(`old text`, {} as any)).toEqual("new text");
  });
  it("passes inputValues context to parser function", () => {
    const parser = createCustomParser("context-parser", (text, context) => {
      return { text, hasContext: !!context };
    });
    const result = parser.parse("hello", { input: {}, output: null } as any);
    expect(result).toEqual({ text: "hello", hasContext: true });
  });
  it("parserFn is accessible on the instance", () => {
    const fn = (text: string) => text.toUpperCase();
    const parser = new CustomParser("upper", fn);
    expect(parser.parserFn).toBe(fn);
  });
  it("handles empty string input", () => {
    const parser = createCustomParser("empty-handler", (text) => {
      return text.length;
    });
    expect(parser.parse("", {} as any)).toEqual(0);
  });
  it("can return complex objects", () => {
    const parser = createCustomParser("json-extractor", (text) => {
      const parts = text.split(",");
      return { items: parts, count: parts.length };
    });
    const result = parser.parse("a,b,c", {} as any);
    expect(result).toEqual({ items: ["a", "b", "c"], count: 3 });
  });
  it("can return arrays", () => {
    const parser = createCustomParser("array-parser", (text) => {
      return text.split(" ");
    });
    expect(parser.parse("one two three", {} as any)).toEqual(["one", "two", "three"]);
  });
  it("returns falsy values exactly", () => {
    const zeroParser = createCustomParser("zero-parser", () => 0);
    const falseParser = createCustomParser("false-parser", () => false);
    expect(zeroParser.parse("ignored", {} as any)).toEqual(0);
    expect(falseParser.parse("ignored", {} as any)).toEqual(false);
  });
  it("lets parser function errors propagate", () => {
    const error = new Error("custom failure");
    const parser = createCustomParser("throwing-parser", () => {
      throw error;
    });
    expect(() => parser.parse("ignored", {} as any)).toThrow(error);
  });
  it("parser function receives this context bound to parser", () => {
    const parser = new CustomParser("self-ref", function (this: any, text) {
      return { text, parserName: this.name };
    });
    const result = parser.parse("test", {} as any);
    expect(result).toEqual({ text: "test", parserName: "self-ref" });
  });
});
