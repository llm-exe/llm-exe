
import { BaseParser, JsonParser } from "@/parser";
import { defineSchema } from "@/utils/modules/defineSchema";
import { LlmExeError } from "@/errors";

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
  it('parses array JSON correctly', () => {
    const parser = new JsonParser()
    const input = JSON.stringify([{ name: "Greg" }])
    expect(parser.parse(input)).toEqual(JSON.parse(input))
  });
  it('parses already-parsed plain object input', () => {
    const parser = new JsonParser()
    const input = { name: "Greg" }
    expect(parser.parse(input as any)).toBe(input)
  });
  it('parses already-parsed array input', () => {
    const parser = new JsonParser()
    const input = [{ name: "Greg" }]
    expect(parser.parse(input as any)).toBe(input)
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
  it('validates schema by default when schema is provided', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    try {
      parser.parse(JSON.stringify({ age: 25 }))
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.schema_validation_failed")
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
      })
    }
  });
  it('preserves schema filter/default-only behavior when validateSchema is false', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema, validateSchema: false })
    expect(parser.parse(JSON.stringify({ age: 25 }))).toEqual({ name: "unknown" })
  });
  it('throws when a required field with a default is missing', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    expect(() => parser.parse("{}")).toThrow(LlmExeError)
    try {
      parser.parse("{}")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect((e as LlmExeError).code).toEqual("parser.schema_validation_failed")
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
      })
    }
  });
  it('throws when a required numeric field with a default is missing', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: "number", default: 0 },
      },
      required: ["count"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    expect(() => parser.parse("{}")).toThrow(LlmExeError)
  });
  it('does not coerce string values before schema validation', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["count", "active"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    expect(() =>
      parser.parse(JSON.stringify({ count: "42", active: "false" }))
    ).toThrow(LlmExeError)
  });
  it('rejects additional properties before filtering when additionalProperties is false', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema })
    expect(() =>
      parser.parse(JSON.stringify({ name: "Greg", age: 25 }))
    ).toThrow(LlmExeError)
  });
  it('preserves additional properties when schema allows them', () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: true,
    } as const;
    const parser = new JsonParser({ schema })
    expect(parser.parse(JSON.stringify({ name: "Greg", age: 25 }))).toEqual({
      name: "Greg",
      age: 25,
    })
  });
  it('preserves additional properties when additionalProperties is omitted', () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    } as const;
    const parser = new JsonParser({ schema })
    expect(parser.parse(JSON.stringify({ name: "Greg", age: 25 }))).toEqual({
      name: "Greg",
      age: 25,
    })
  });
  it('throws parser.parse_failed for invalid JSON', () => {
    const parser = new JsonParser()
    try {
      parser.parse("This is not JSON at all")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.parse_failed")
      expect((e as LlmExeError).context).toEqual({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json",
        expected: "JSON object or array",
        inputLength: 23,
      })
      expect((e as any).cause).toBeInstanceOf(SyntaxError)
    }
  });
  it('throws parser.parse_failed for empty input', () => {
    const parser = new JsonParser()
    try {
      parser.parse("")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toEqual({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "empty_input",
        expected: "JSON object or array",
        inputLength: 0,
      })
    }
  });
  it('throws parser.parse_failed for JSON primitives', () => {
    const parser = new JsonParser()
    try {
      parser.parse("42")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toEqual({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json_root_type",
        expected: "JSON object or array",
        received: "number",
        inputLength: 2,
      })
    }
  });
  it('throws parser.parse_failed for JSON null root', () => {
    const parser = new JsonParser()
    try {
      parser.parse("null")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json_root_type",
        received: "null",
      })
    }
  });
  it('parses whole-response json fences case-insensitively', () => {
    const parser = new JsonParser()
    expect(parser.parse("```JSON\n{\"name\":\"Greg\"}\n```")).toEqual({ name: "Greg" })
    expect(parser.parse("```\n[{\"name\":\"Greg\"}]\n```")).toEqual([{ name: "Greg" }])
  });
  it('does not extract fenced JSON from prose', () => {
    const parser = new JsonParser()
    expect(() => parser.parse("Here is JSON:\n```json\n{\"name\":\"Greg\"}\n```")).toThrow(LlmExeError)
  });
  it('rejects whole-response non-json fenced blocks as invalid JSON', () => {
    const parser = new JsonParser()
    try {
      parser.parse("```ts\n{\"name\":\"Greg\"}\n```")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.parse_failed")
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json",
      })
      expect((e as Error & { cause?: unknown }).cause).toBeInstanceOf(SyntaxError)
    }
  });
  it('throws parser.parse_failed for runtime null', () => {
    const parser = new JsonParser()
    expect(() => parser.parse(null as any)).toThrow(LlmExeError)
  });
  it('throws parser.parse_failed for runtime class instances', () => {
    class Example {
      value = "x";
    }
    const parser = new JsonParser()
    expect(() => parser.parse(new Example() as any)).toThrow(LlmExeError)
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
