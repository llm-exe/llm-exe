

import {
  applyParserSchemaDefaultsAndFilter,
  coerceParserSchemaValues,
  enforceParserSchema,
  validateParserSchema,
} from "@/parser/_utils";
import { defineSchema } from "@/utils/modules/defineSchema";

/**
 * Tests the enforceParserSchema 
 */
describe("llm-exe:parser/_utils/enforceParserSchema", () => {
  it('parses simple string correctly', () => {
    const schema = defineSchema({
        type: "object",
        properties: {
          name: { type: "string", default: "unknown" },
          age: { type: "integer", default: 0 },
        },
        required: ["age", "name"],
        additionalProperties: false,
      });

    const obj = { name: "greg", age: "82"}
    const enforce = enforceParserSchema(schema, obj);

    expect(enforce).toEqual({ name: "greg", age: 82})
  });
  it('returns with invalid input', () => {
    const schema = defineSchema({
        type: "object",
        properties: {
          name: { type: "string", default: "unknown" },
          age: { type: "integer", default: 0 },
        },
        required: ["age", "name"],
        additionalProperties: false,
      });

    const obj = `{ name: "greg", age: "82"}`
    const enforce = enforceParserSchema(schema, obj);
    expect(enforce).toEqual(obj)
  });
  it('returns with invalid schema', () => {
    const obj = { name: "greg", age: "82"}
    // @ts-expect-error runtime compatibility: invalid schema is returned through unchanged.
    const enforce = enforceParserSchema(null, obj);
    expect(enforce).toEqual(obj)
  });
});

describe("llm-exe:parser/_utils/coerceParserSchemaValues", () => {
  it("coerces number and boolean strings using schema types", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        age: { type: "integer" },
        score: { type: "number" },
        active: { type: "boolean" },
      },
      additionalProperties: false,
    });

    expect(
      coerceParserSchemaValues(schema, {
        age: "82",
        score: "9.5",
        active: "false",
      })
    ).toEqual({ age: 82, score: 9.5, active: false });
  });

  it("leaves invalid coercion candidates for schema validation", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
      additionalProperties: false,
    });

    expect(coerceParserSchemaValues(schema, { active: "maybe" })).toEqual({
      active: "maybe",
    });
  });

  it("recurses through nested objects", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        person: {
          type: "object",
          properties: {
            age: { type: "integer" },
            active: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    });

    expect(
      coerceParserSchemaValues(schema, {
        person: { age: "82", active: "true" },
      })
    ).toEqual({ person: { age: 82, active: true } });
  });

  it("recurses through arrays of primitives and objects", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        scores: { type: "array", items: { type: "number" } },
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              active: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    });

    expect(
      coerceParserSchemaValues(schema, {
        scores: ["1", "2.5"],
        people: [{ active: "false" }],
      })
    ).toEqual({ scores: [1, 2.5], people: [{ active: false }] });
  });

  it("leaves already-typed values and nullable null values unchanged", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: ["number", "null"] },
        active: { type: "boolean" },
      },
      additionalProperties: false,
    });

    expect(coerceParserSchemaValues(schema, { count: null, active: true })).toEqual({
      count: null,
      active: true,
    });
  });

  it("uses the first non-null type from nullable schema unions", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: ["null", "number"] },
      },
      additionalProperties: false,
    });

    expect(coerceParserSchemaValues(schema, { count: "42" })).toEqual({
      count: 42,
    });
  });

  it("leaves arrays unchanged when object schema recursion does not apply", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: "number" },
      },
      additionalProperties: false,
    });

    expect(coerceParserSchemaValues(schema, ["42"])).toEqual(["42"]);
  });

  it("coerces null-prototype plain objects", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        count: { type: "number" },
      },
      additionalProperties: false,
    });
    const value = Object.create(null);
    value.count = "42";

    expect(coerceParserSchemaValues(schema, value)).toEqual({ count: 42 });
  });

  it("leaves object values unchanged when object schema has no coercion properties", () => {
    const schema = { type: "object" } as const;
    const value = { count: "42" };

    expect(coerceParserSchemaValues(schema, value)).toEqual(value);
  });

  it("preserves unknown keys for later validation or filtering", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        age: { type: "integer" },
      },
      additionalProperties: false,
    });

    expect(coerceParserSchemaValues(schema, { age: "82", extra: "kept" })).toEqual({
      age: 82,
      extra: "kept",
    });
  });
});

describe("llm-exe:parser/_utils/applyParserSchemaDefaultsAndFilter", () => {
  it("applies defaults and filters unknown properties without coercing values", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
        active: { type: "boolean" },
      },
      additionalProperties: false,
    });

    expect(
      applyParserSchemaDefaultsAndFilter(schema, {
        active: "false",
        extra: "removed",
      })
    ).toEqual({ name: "unknown", active: "false" });
  });

  it("applies nested object and array item defaults", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        person: {
          type: "object",
          properties: {
            name: { type: "string", default: "unknown" },
          },
          additionalProperties: false,
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", default: "untitled" },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    });

    expect(
      applyParserSchemaDefaultsAndFilter(schema, {
        person: {},
        items: [{}],
      })
    ).toEqual({ person: { name: "unknown" }, items: [{ label: "untitled" }] });
  });

  it("returns nullish values unchanged", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
    });

    expect(applyParserSchemaDefaultsAndFilter(schema, null)).toBeNull();
    expect(applyParserSchemaDefaultsAndFilter(schema, undefined)).toBeUndefined();
    expect(applyParserSchemaDefaultsAndFilter(undefined, { name: "Greg" })).toEqual({
      name: "Greg",
    });
  });

  it("leaves object values unchanged when object schema has no properties", () => {
    const schema = { type: "object" } as const;
    const value = { extra: "kept" };

    expect(applyParserSchemaDefaultsAndFilter(schema, value)).toEqual(value);
  });

  it("applies required defaults only when called after validation succeeds", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      required: ["name"],
      additionalProperties: false,
    });

    expect(applyParserSchemaDefaultsAndFilter(schema, {})).toEqual({
      name: "unknown",
    });
  });

  it("preserves unknown keys when additionalProperties is true", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      additionalProperties: true,
    } as const;

    expect(
      applyParserSchemaDefaultsAndFilter(schema, {
        extra: "kept",
      })
    ).toEqual({ extra: "kept", name: "unknown" });
  });

  it("preserves unknown keys when additionalProperties is missing", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
    } as const;

    expect(
      applyParserSchemaDefaultsAndFilter(schema, {
        extra: "kept",
      })
    ).toEqual({ extra: "kept", name: "unknown" });
  });

  it("filters unknown keys when additionalProperties is false", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "unknown" },
      },
      additionalProperties: false,
    });

    expect(
      applyParserSchemaDefaultsAndFilter(schema, {
        extra: "removed",
      })
    ).toEqual({ name: "unknown" });
  });
});

/**
 * Tests the validateParserSchema 
 */
describe("llm-exe:parser/_utils/validateParserSchema", () => {
    it('null if no errors', () => {
      const schema = defineSchema({
          type: "object",
          properties: {
            name: { type: "string", default: "unknown" },
            age: { type: "integer", default: 0 },
          },
          required: ["age", "name"],
          additionalProperties: false,
        });
  
      const obj = { name: "greg", age: 82}
      const validate = validateParserSchema(schema, obj);
      expect(validate).toEqual(null)
    });
    it('error if invalid', () => {
      const schema = defineSchema({
          type: "object",
          properties: {
            name: { type: "string", default: "unknown" },
            age: { type: "integer", default: 0 },
          },
          required: ["age", "name"],
          additionalProperties: false,
        });
  
        const obj = { name: "greg", age: "82"}
      const enforce = validateParserSchema(schema, obj);
      expect(typeof enforce).toEqual("object")
      expect(Array.isArray(enforce)).toEqual(true)
    });
    it('returns with invalid input', () => {
        const schema = defineSchema({
            type: "object",
            properties: {
              name: { type: "string", default: "unknown" },
              age: { type: "integer", default: 0 },
            },
            required: ["age", "name"],
            additionalProperties: false,
          });
    
        const obj = `{ name: "greg", age: "82"}`
        // @ts-expect-error runtime compatibility: non-object parsed values do not validate.
        const enforce = validateParserSchema(schema, obj);
        expect(enforce).toEqual(null)
      });
    it('returns with invalid schema', () => {
      const obj = { name: "greg", age: "82"}
      // @ts-expect-error runtime compatibility: invalid schema returns no validation errors.
      const enforce = validateParserSchema(null, obj);
      expect(enforce).toEqual(null)
    });
  });
  
