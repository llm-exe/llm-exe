
import { BaseParser, JsonParser } from "@/parser";
import { defineSchema } from "@/utils/modules/defineSchema";

/**
 * Tests the JsonParser class
 */
describe("llm-exe:parser/JsonParser", () => {
  it('creates class with expected properties', () => {
    const parser = new JsonParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(JsonParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("json")
  })
  it('parses simple string correctly', () => {
    const parser = new JsonParser()
    const input = JSON.stringify({ name: "Greg", occupation: "developer"})
    expect(parser.parse(input)).toEqual(JSON.parse(input))
  });
  it('parses simple string correctly', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        occupation: { type: "string", default: "unemployed" },
      },
      required: ["occupation", "name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    const input = JSON.stringify({ name: "Greg", occupation: "developer"})
    expect(parser.parse(input)).toEqual(JSON.parse(input))
  });


  it('parses simple string correctly', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        confused: { type: "boolean", default: false },
      },
      required: ["confused", "name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    const input = JSON.stringify({ name: "Greg", confused: true})
    expect(parser.parse(input)).toEqual(JSON.parse(input))
  });

  it('parses schema with error when set', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        occupation: { type: "string", default: 0 },
      },
      required: ["occupation", "name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema, validateSchema: true })
    const input = JSON.stringify({ name: "Greg", occupation: 0})
    expect(() => parser.parse(input)).toThrowError("is not of a type(s) string")
  });

  describe("malformed and edge inputs (locks in current behavior, see issue #148)", () => {
    it("returns {} for completely unparseable input", () => {
      const parser = new JsonParser();
      expect(parser.parse("not json at all")).toEqual({});
    });

    it("returns {} for empty string input", () => {
      const parser = new JsonParser();
      expect(parser.parse("")).toEqual({});
    });

    it("returns {} for whitespace-only input", () => {
      const parser = new JsonParser();
      expect(parser.parse("   \n\t  ")).toEqual({});
    });

    it("returns {} when JSON parses to a primitive (number)", () => {
      const parser = new JsonParser();
      expect(parser.parse("42")).toEqual({});
    });

    it("returns {} when JSON parses to a primitive (string)", () => {
      const parser = new JsonParser();
      expect(parser.parse('"just a string"')).toEqual({});
    });

    it("returns {} when JSON parses to literal null", () => {
      const parser = new JsonParser();
      expect(parser.parse("null")).toEqual({});
    });

    it("returns {} when JSON parses to boolean", () => {
      const parser = new JsonParser();
      expect(parser.parse("true")).toEqual({});
    });

    it("returns parsed array for top-level array JSON", () => {
      const parser = new JsonParser();
      expect(parser.parse("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("returns parsed object for nested structures", () => {
      const parser = new JsonParser();
      const input = JSON.stringify({
        outer: { inner: { deep: [1, { x: "y" }] } },
      });
      expect(parser.parse(input)).toEqual({
        outer: { inner: { deep: [1, { x: "y" }] } },
      });
    });

    it("returns {} for malformed JSON with trailing comma", () => {
      const parser = new JsonParser();
      expect(parser.parse('{"a": 1,}')).toEqual({});
    });

    it("returns {} for JSON with unbalanced braces", () => {
      const parser = new JsonParser();
      expect(parser.parse('{"a": 1')).toEqual({});
    });
  });

  describe("markdown-wrapped JSON", () => {
    it("strips ```json ... ``` wrapper before parsing", () => {
      const parser = new JsonParser();
      const input = '```json\n{"a": 1, "b": "two"}\n```';
      expect(parser.parse(input)).toEqual({ a: 1, b: "two" });
    });

    it("strips wrapper with extra whitespace around content", () => {
      const parser = new JsonParser();
      const input = '```json\n   {"a": 1}   \n```';
      expect(parser.parse(input)).toEqual({ a: 1 });
    });

    it("leaves a plain ``` block (no 'json' tag) un-stripped — returns {}", () => {
      const parser = new JsonParser();
      const input = '```\n{"a": 1}\n```';
      // helpJsonMarkup only strips when the prefix is exactly ```json
      expect(parser.parse(input)).toEqual({});
    });
  });

  describe("schema enforcement without validateSchema", () => {
    it("applies schema defaults when fields are missing", () => {
      const schema = defineSchema({
        type: "object",
        properties: {
          name: { type: "string", default: "unknown" },
          occupation: { type: "string", default: "unemployed" },
        },
        required: ["occupation", "name"],
        additionalProperties: false,
      });
      const parser = new JsonParser({ schema });
      const result = parser.parse(JSON.stringify({ name: "Greg" }));
      expect(result).toEqual({ name: "Greg", occupation: "unemployed" });
    });

    it("does not throw on type mismatch when validateSchema is not set (silent enforce)", () => {
      const schema = defineSchema({
        type: "object",
        properties: {
          age: { type: "number" },
        },
        required: ["age"],
        additionalProperties: false,
      });
      const parser = new JsonParser({ schema });
      // With validateSchema unset, mismatched types pass through without throwing.
      // This documents existing behavior — validateSchema must be explicitly enabled
      // to surface schema violations.
      expect(() =>
        parser.parse(JSON.stringify({ age: "not a number" }))
      ).not.toThrow();
    });

    it("returns {} (after enforce) when schema is set but input is unparseable", () => {
      const schema = defineSchema({
        type: "object",
        properties: { name: { type: "string", default: "fallback" } },
        required: ["name"],
        additionalProperties: false,
      });
      const parser = new JsonParser({ schema });
      // maybeParseJSON returns {}, then enforce applies the default
      expect(parser.parse("garbage input")).toEqual({ name: "fallback" });
    });
  });

  describe("validateSchema strict mode", () => {
    it("throws when required field is missing", () => {
      const schema = defineSchema({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      });
      const parser = new JsonParser({ schema, validateSchema: true });
      expect(() =>
        parser.parse(JSON.stringify({ name: "Greg" }))
      ).toThrowError(/age/);
    });

    it("throws with first error message when multiple validation errors exist", () => {
      const schema = defineSchema({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      });
      const parser = new JsonParser({ schema, validateSchema: true });
      // Both fields invalid — should throw on the first one
      expect(() =>
        parser.parse(JSON.stringify({ name: 42, age: "old" }))
      ).toThrow();
    });
  });

});

