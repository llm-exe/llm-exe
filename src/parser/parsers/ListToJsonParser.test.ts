
import { BaseParser, ListToJsonParser } from "@/parser";
import { defineSchema } from "@/utils/modules/defineSchema";
import { LlmExeError } from "@/errors";

/**
 * Tests the ListToJsonParser class
 */
describe("llm-exe:parser/ListToJsonParser", () => {
  it('creates class with expected properties', () => {
    const parser = new ListToJsonParser()
    expect(parser).toBeInstanceOf(BaseParser)
    expect(parser).toBeInstanceOf(ListToJsonParser)
    expect(parser).toHaveProperty("name")
    expect(parser.name).toEqual("listToJson")
  })
  it('parses simple string correctly', () => {
    const parser = new ListToJsonParser()
    const input = `Name: Greg\nOccupation: developer`
    expect(parser.parse(input)).toEqual({ name: "Greg", occupation: "developer"})
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
    const parser = new ListToJsonParser({ schema })
    const input = `Name: Greg\nOccupation: developer`
    expect(parser.parse(input)).toEqual({ name: "Greg", occupation: "developer"})
  });
  it('preserves colons in values (URLs)', () => {
    const parser = new ListToJsonParser()
    const input = `URL: https://example.com\nName: Greg`
    expect(parser.parse(input)).toEqual({ url: "https://example.com", name: "Greg"})
  });
  it('preserves colons in values (timestamps)', () => {
    const parser = new ListToJsonParser()
    const input = `Time: 10:30:00\nEvent: meeting`
    expect(parser.parse(input)).toEqual({ time: "10:30:00", event: "meeting"})
  });
  it('camelCases keys by default', () => {
    const parser = new ListToJsonParser()
    const input = `First Name: John\nLast Name: Doe`
    expect(parser.parse(input)).toEqual({ firstName: "John", lastName: "Doe"})
  });
  it('preserves keys when keyTransform is "preserve"', () => {
    const parser = new ListToJsonParser({ keyTransform: "preserve" })
    const input = `First Name: John\nLast Name: Doe`
    expect(parser.parse(input)).toEqual({ "First Name": "John", "Last Name": "Doe"})
  });
  it('camelCases keys when keyTransform is "camelCase"', () => {
    const parser = new ListToJsonParser({ keyTransform: "camelCase" })
    const input = `First Name: John\nLast Name: Doe`
    expect(parser.parse(input)).toEqual({ firstName: "John", lastName: "Doe"})
  });
  it('preserves keys with colons in values', () => {
    const parser = new ListToJsonParser({ keyTransform: "preserve" })
    const input = `Website URL: https://example.com\nFull Name: Greg`
    expect(parser.parse(input)).toEqual({ "Website URL": "https://example.com", "Full Name": "Greg"})
  });
  it('preserves keys with schema', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        "First Name": { type: "string", default: "unknown" },
        "Last Name": { type: "string", default: "unknown" },
      },
      required: ["First Name", "Last Name"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema, keyTransform: "preserve" })
    const input = `First Name: John\nLast Name: Doe`
    expect(parser.parse(input)).toEqual({ "First Name": "John", "Last Name": "Doe"})
  });
  it('validates schema by default before applying defaults', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        occupation: { type: "string", default: 0 },
      },
      required: ["occupation", "name"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema, validateSchema: true })
    const input = `Name: Greg\n`
    try {
      parser.parse(input)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.schema_validation_failed")
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToJsonParser.parse",
        parser: "listToJson",
      })
    }
  });
  it('throws by default when schema required fields are missing', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema })
    try {
      parser.parse(`Age: 82`)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.schema_validation_failed")
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToJsonParser.parse",
        parser: "listToJson",
      })
    }
  });
  it('coerces schema-typed scalar values before validation', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        age: { type: "integer" },
        score: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["age", "score", "active"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema })
    const input = `Age: 82\nScore: 9.5\nActive: false`
    expect(parser.parse(input)).toEqual({ age: 82, score: 9.5, active: false })
  });
  it('rejects invalid schema-typed scalar values after coercion', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
      required: ["active"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema })
    try {
      parser.parse(`Active: maybe`)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).code).toEqual("parser.schema_validation_failed")
    }
  });
  it('rejects uncoercible numeric schema values after coercion', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        age: { type: "number" },
      },
      required: ["age"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema })
    expect(() => parser.parse(`Age: hello`)).toThrow(LlmExeError)
    try {
      parser.parse(`Age: hello`)
      fail("Expected an error to be thrown")
    } catch (e) {
      expect((e as LlmExeError).code).toEqual("parser.schema_validation_failed")
    }
  });
  it('applies optional defaults after validation', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string" },
        occupation: { type: "string", default: "unemployed" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema })
    expect(parser.parse(`Name: Greg`)).toEqual({
      name: "Greg",
      occupation: "unemployed",
    })
  });
  it('preserves default/filter behavior when schema validation is disabled', () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      required: ["name"],
      additionalProperties: false,
    });
    const parser = new ListToJsonParser({ schema, validateSchema: false })
    expect(parser.parse(`Age: 82`)).toEqual({ name: "unknown" })
  });
  it('accepts empty values', () => {
    const parser = new ListToJsonParser()
    expect(parser.parse("Name:")).toEqual({ name: "" })
  });
  it('strips shared list markers', () => {
    const parser = new ListToJsonParser()
    const input = `- Name: Greg\n* Occupation: developer`
    expect(parser.parse(input)).toEqual({ name: "Greg", occupation: "developer" })
  });
  it('throws parser.parse_failed for malformed lines', () => {
    const parser = new ListToJsonParser()
    try {
      parser.parse("Name Greg")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToJsonParser.parse",
        parser: "listToJson",
        reason: "malformed_line",
      })
    }
  });
  it('throws parser.parse_failed for empty keys', () => {
    const parser = new ListToJsonParser()
    try {
      parser.parse(": Greg")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToJsonParser.parse",
        parser: "listToJson",
        reason: "empty_key",
      })
    }
  });
  it('throws parser.parse_failed for duplicate keys', () => {
    const parser = new ListToJsonParser()
    try {
      parser.parse("Name: Greg\nName: Bob")
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        operation: "ListToJsonParser.parse",
        parser: "listToJson",
        reason: "duplicate_key",
      })
    }
  });
  it('throws parser.parse_failed for mixed marked and unmarked lines', () => {
    const parser = new ListToJsonParser()
    expect(() => parser.parse("- Name: Greg\nOccupation: developer")).toThrow(LlmExeError)
  });
  it('throws parser.parse_failed for empty input', () => {
    const parser = new ListToJsonParser()
    expect(() => parser.parse("")).toThrow(LlmExeError)
  });
  it('throws parser.parse_failed for invalid input type', () => {
    const parser = new ListToJsonParser()
    expect(() => {
      // @ts-expect-error runtime contract: parser rejects null input.
      parser.parse(null)
    }).toThrow(LlmExeError)
  });
  it('describes array invalid input type in parser context', () => {
    const parser = new ListToJsonParser()
    try {
      // @ts-expect-error runtime contract: parser rejects array input.
      parser.parse([])
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "array",
      })
    }
  });
  it('describes object invalid input type in parser context', () => {
    const parser = new ListToJsonParser()
    try {
      // @ts-expect-error runtime contract: parser rejects object input.
      parser.parse({})
      fail("Expected an error to be thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError)
      expect((e as LlmExeError).context).toMatchObject({
        reason: "invalid_input_type",
        received: "object",
      })
    }
  });
});
