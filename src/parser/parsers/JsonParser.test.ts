import { BaseParser, JsonParser } from "@/parser";
import { defineSchema } from "@/utils/modules/defineSchema";
import { LlmExeError } from "@/errors";

/**
 * Tests the JsonParser class
 */
describe("llm-exe:parser/JsonParser", () => {
  it("creates class with expected properties", () => {
    const parser = new JsonParser();
    expect(parser).toBeInstanceOf(BaseParser);
    expect(parser).toBeInstanceOf(JsonParser);
    expect(parser).toHaveProperty("name");
    expect(parser.name).toEqual("json");
  });
  it("parses simple string correctly", () => {
    const parser = new JsonParser();
    const input = JSON.stringify({ name: "Greg", occupation: "developer" });
    expect(parser.parse(input)).toEqual(JSON.parse(input));
  });
  it("parses array JSON correctly", () => {
    const parser = new JsonParser();
    const input = JSON.stringify([{ name: "Greg" }]);
    expect(parser.parse(input)).toEqual(JSON.parse(input));
  });
  it("parses already-parsed plain object input", () => {
    const parser = new JsonParser();
    const input = { name: "Greg" };
    expect(parser.parse(input as any)).toBe(input);
  });
  it("parses already-parsed array input", () => {
    const parser = new JsonParser();
    const input = [{ name: "Greg" }];
    expect(parser.parse(input as any)).toBe(input);
  });
  it("parses simple string correctly", () => {
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
    const input = JSON.stringify({ name: "Greg", occupation: "developer" });
    expect(parser.parse(input)).toEqual(JSON.parse(input));
  });

  it("parses simple string correctly", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        confused: { type: "boolean", default: false },
      },
      required: ["confused", "name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema });
    const input = JSON.stringify({ name: "Greg", confused: true });
    expect(parser.parse(input)).toEqual(JSON.parse(input));
  });

  it("parses schema with error when set", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        occupation: { type: "string", default: 0 },
      },
      required: ["occupation", "name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema, validateSchema: true });
    const input = JSON.stringify({ name: "Greg", occupation: 0 });
    expect(() => parser.parse(input)).toThrowError(
      "is not of a type(s) string",
    );
  });
  it("validates schema by default when schema is provided", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema });
    try {
      parser.parse(JSON.stringify({ age: 25 }));
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual(
        "parser.schema_validation_failed",
      );
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
      });
    }
  });
  it("preserves schema filter/default-only behavior when validateSchema is false", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema, validateSchema: false });
    expect(parser.parse(JSON.stringify({ age: 25 }))).toEqual({
      name: "unknown",
    });
  });
  it("throws when a required field with a default is missing", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema });
    expect(() => parser.parse("{}")).toThrow(LlmExeError);
    try {
      parser.parse("{}");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect((e as LlmExeError).code).toEqual(
        "parser.schema_validation_failed",
      );
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
      });
    }
  });
  it("throws when a required numeric field with a default is missing", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: "number", default: 0 },
      },
      required: ["count"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema });
    expect(() => parser.parse("{}")).toThrow(LlmExeError);
  });
  it("does not coerce string values before schema validation", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["count", "active"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema });
    expect(() =>
      parser.parse(JSON.stringify({ count: "42", active: "false" })),
    ).toThrow(LlmExeError);
  });
  it("rejects additional properties before filtering when additionalProperties is false", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new JsonParser({ schema });
    expect(() =>
      parser.parse(JSON.stringify({ name: "Greg", age: 25 })),
    ).toThrow(LlmExeError);
  });
  it("preserves additional properties when schema allows them", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: true,
    } as const;
    const parser = new JsonParser({ schema });
    expect(parser.parse(JSON.stringify({ name: "Greg", age: 25 }))).toEqual({
      name: "Greg",
      age: 25,
    });
  });
  it("preserves additional properties when additionalProperties is omitted", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    } as const;
    const parser = new JsonParser({ schema });
    expect(parser.parse(JSON.stringify({ name: "Greg", age: 25 }))).toEqual({
      name: "Greg",
      age: 25,
    });
  });
  it("throws parser.parse_failed for invalid JSON", () => {
    const parser = new JsonParser();
    try {
      parser.parse("This is not JSON at all");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toEqual({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json",
        expected: "JSON object or array",
        inputLength: 23,
      });
      expect((e as any).cause).toBeInstanceOf(SyntaxError);
    }
  });
  it("throws parser.parse_failed for empty input", () => {
    const parser = new JsonParser();
    try {
      parser.parse("");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "empty_input",
        expected: "JSON object or array",
        inputLength: 0,
      });
    }
  });
  it("throws parser.parse_failed for JSON primitives", () => {
    const parser = new JsonParser();
    try {
      parser.parse("42");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toEqual({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json_root_type",
        expected: "JSON object or array",
        received: "number",
        inputLength: 2,
      });
    }
  });
  it("throws parser.parse_failed for JSON null root", () => {
    const parser = new JsonParser();
    try {
      parser.parse("null");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json_root_type",
        received: "null",
      });
    }
  });
  it("parses exact-response json fences case-insensitively", () => {
    const parser = new JsonParser();
    expect(parser.parse('```JSON\n{"name":"Greg"}\n```')).toEqual({
      name: "Greg",
    });
    expect(parser.parse('```\n[{"name":"Greg"}]\n```')).toEqual([
      { name: "Greg" },
    ]);
  });
  it("does not extract fenced JSON from prose", () => {
    const parser = new JsonParser();
    expect(() =>
      parser.parse('Here is JSON:\n```json\n{"name":"Greg"}\n```'),
    ).toThrow(LlmExeError);
  });
  describe("match: extract", () => {
    it("extracts a JSON object from surrounding text", () => {
      const parser = new JsonParser({ match: "extract" });
      expect(parser.parse('Here is JSON: {"name":"Greg"}')).toEqual({
        name: "Greg",
      });
    });
    it("extracts a JSON array from surrounding text", () => {
      const parser = new JsonParser({ match: "extract" });
      expect(parser.parse('Results: [{"name":"Greg"}]')).toEqual([
        { name: "Greg" },
      ]);
    });
    it("extracts fenced JSON from surrounding text", () => {
      const parser = new JsonParser({ match: "extract" });
      expect(
        parser.parse('Here is JSON:\n```json\n{"name":"Greg"}\n```'),
      ).toEqual({ name: "Greg" });
    });
    it("keeps nested objects and arrays as one match", () => {
      const parser = new JsonParser({ match: "extract" });
      expect(parser.parse('Result: {"outer":{"inner":[{"x":1}]}}')).toEqual({
        outer: { inner: [{ x: 1 }] },
      });
    });
    it("throws when multiple JSON values are found", () => {
      const parser = new JsonParser({ match: "extract" });
      try {
        parser.parse('First: {"a":1}. Second: {"b":2}.');
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).context).toMatchObject({
          reason: "ambiguous_json_match",
          expected: "one JSON object or array",
          match: "extract",
          matchCount: 2,
        });
      }
    });
    it("throws when no JSON value is found", () => {
      const parser = new JsonParser({ match: "extract" });
      try {
        parser.parse("not json");
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).context).toMatchObject({
          reason: "no_json_value",
          expected: "JSON object or array",
          match: "extract",
        });
      }
    });
    it("validates schema after extraction", () => {
      const schema = defineSchema({
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      });
      const parser = new JsonParser({ schema, match: "extract" });
      expect(parser.parse('Here is JSON: {"name":"Greg"}')).toEqual({
        name: "Greg",
      });
      expect(() => parser.parse('Here is JSON: {"age":25}')).toThrow(
        LlmExeError,
      );
    });
  });
  it("rejects exact-response non-json fenced blocks as invalid JSON", () => {
    const parser = new JsonParser();
    try {
      parser.parse('```ts\n{"name":"Greg"}\n```');
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toEqual("parser.parse_failed");
      expect((e as LlmExeError).context).toMatchObject({
        operation: "JsonParser.parse",
        parser: "json",
        reason: "invalid_json",
      });
      expect((e as Error & { cause?: unknown }).cause).toBeInstanceOf(
        SyntaxError,
      );
    }
  });
  it("throws parser.parse_failed for runtime null", () => {
    const parser = new JsonParser();
    expect(() => parser.parse(null as any)).toThrow(LlmExeError);
  });
  it("throws parser.parse_failed for runtime class instances", () => {
    class Example {
      value = "x";
    }
    const parser = new JsonParser();
    expect(() => parser.parse(new Example() as any)).toThrow(LlmExeError);
  });

  describe("nested and array structures", () => {
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

    it("strips a plain ``` fence with no language tag", () => {
      const parser = new JsonParser();
      const input = '```\n{"a": 1}\n```';
      expect(parser.parse(input)).toEqual({ a: 1 });
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
      expect(() => parser.parse(JSON.stringify({ name: "Greg" }))).toThrowError(
        /age/,
      );
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
        parser.parse(JSON.stringify({ name: 42, age: "old" })),
      ).toThrow();
    });
  });

  // Regression for issue #635. The report claimed that passing a schema with
  // `required` fields WITHOUT `validateSchema: true` would strip unknown keys
  // but silently accept input missing required fields (e.g. `{"age":25}` => `{}`).
  // That described the old default-falsy behavior. The current contract is the
  // opposite: when a schema is provided, validation — including `required` — is
  // ON by default, and only `validateSchema: false` opts back into the
  // filter/default-only path. These tests pin the issue's exact reproduction so
  // the stale behavior cannot silently return.
  describe("issue #635: required enforced by default when schema provided", () => {
    const schema = defineSchema({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });

    it("throws on input missing a required field by default (no validateSchema)", () => {
      const parser = new JsonParser({ schema });
      try {
        parser.parse('{"age": 25}');
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toEqual(
          "parser.schema_validation_failed",
        );
        expect((e as LlmExeError).message).toMatch(/name/);
        expect((e as LlmExeError).context).toMatchObject({
          operation: "JsonParser.parse",
          parser: "json",
        });
      }
    });

    it("does NOT silently return a partial/empty object by default", () => {
      const parser = new JsonParser({ schema });
      // The bug report's claimed `=> {}` outcome must never happen by default.
      expect(() => parser.parse('{"age": 25}')).toThrow(LlmExeError);
    });

    it("only opts back into filter-without-required when validateSchema: false", () => {
      const parser = new JsonParser({ schema, validateSchema: false });
      // Explicit opt-out: unknown keys stripped, missing required NOT flagged.
      expect(parser.parse('{"age": 25}')).toEqual({});
    });

    it("validateSchema: true matches the default (required enforced)", () => {
      const parser = new JsonParser({ schema, validateSchema: true });
      expect(() => parser.parse('{"age": 25}')).toThrow(LlmExeError);
    });

    it("accepts input that satisfies the required field by default", () => {
      const parser = new JsonParser({ schema });
      expect(parser.parse('{"name": "Greg"}')).toEqual({ name: "Greg" });
    });
  });

  describe("extract: JSON-in-string brace-walker edge cases", () => {
    it("ignores braces nested inside JSON string values (escaped quotes)", () => {
      // The string value contains escaped quotes — exercises the escape-mode
      // branches of findBalancedJsonEnd.
      const parser = new JsonParser({ match: "extract" });
      const input = 'Result: {"q":"say \\"hi\\" {to {them}}"} done';
      expect(parser.parse(input)).toEqual({ q: 'say "hi" {to {them}}' });
    });

    it("skips an unbalanced opening brace without an end", () => {
      // The opening { never closes — findBalancedJsonEnd returns undefined and
      // the loop moves on. The second {a:1} is a valid candidate.
      const parser = new JsonParser({ match: "extract" });
      expect(parser.parse('Start: { but then {"a":1}')).toEqual({ a: 1 });
    });

    it("skips mismatched bracket pairs (e.g. opens { but tries to close ])", () => {
      // The { is never matched by a }, so findBalancedJsonEnd returns undefined
      // and we fall through to the no-json-value path.
      const parser = new JsonParser({ match: "extract" });
      expect(() => parser.parse('Bad: {"a":1]')).toThrow(LlmExeError);
    });

    it("skips braces in surrounding text when extraction runs", () => {
      // The bare `{` near 'set' has no closer; the real object after that does.
      const parser = new JsonParser({ match: "extract" });
      expect(parser.parse('open { set then {"b":2} end')).toEqual({ b: 2 });
    });

    it("recovers nested JSON when an enclosing balanced block is not valid JSON", () => {
      // The outer braces balance but the block is not JSON; the inner object is.
      const parser = new JsonParser({ match: "extract" });
      expect(parser.parse('{ not json but contains {"a":1} }')).toEqual({
        a: 1,
      });
    });

    it("handles a long run of unbalanced openers in linear time", () => {
      // Regression guard: the previous scanner restarted from every opener,
      // so 50k unmatched `{` cost ~50k full-string rescans (seconds of
      // blocking). The single-pass scanner finishes in milliseconds.
      const parser = new JsonParser({ match: "extract" });
      const input = "{".repeat(50_000) + '{"a":1}';
      const startedAt = Date.now();
      expect(parser.parse(input)).toEqual({ a: 1 });
      expect(Date.now() - startedAt).toBeLessThan(1000);
    });
  });
});
