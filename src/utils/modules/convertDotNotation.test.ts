import { convertDotNotation } from "@/utils/modules/convertDotNotation";

describe("convertDotNotation", () => {
  it("drops prototype-polluting dot-notation keys without touching Object.prototype", () => {
    const input = {
      "__proto__.polluted": "yes",
      "a.constructor.polluted": "yes",
      "b.prototype.polluted": "yes",
      "a.b": "kept",
    };

    const result = convertDotNotation(input);

    expect(result).toEqual({ a: { b: "kept" } });
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("drops a plain __proto__ key instead of replacing the result prototype", () => {
    const input = JSON.parse('{"__proto__": {"polluted": "yes"}, "a": 1}');

    const result = convertDotNotation(input);

    expect(result).toEqual({ a: 1 });
    expect((result as any).polluted).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });

  it("should convert single-level dot notation to nested objects", () => {
    const input = { "a.b": 1, "c.d.e": 2 };
    const expectedOutput = { a: { b: 1 }, c: { d: { e: 2 } } };
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle multiple keys with different nesting levels", () => {
    const input = { "a.b.c": 1, "a.d": 2, "e.f.g.h": 3 };
    const expectedOutput = {
      a: {
        b: { c: 1 },
        d: 2,
      },
      e: {
        f: {
          g: {
            h: 3,
          },
        },
      },
    };
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle keys without dots correctly", () => {
    const input = { a: 1, "b.c": 2, d: 3 };
    const expectedOutput = { a: 1, b: { c: 2 }, d: 3 };
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle empty object correctly", () => {
    const input = {};
    const expectedOutput = {};
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle nested objects as values correctly", () => {
    const input = { "a.b": { x: 1, y: 2 }, "c.d.e": { z: 3 } };
    const expectedOutput = { a: { b: { x: 1, y: 2 } }, c: { d: { e: { z: 3 } } } };
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle keys with multiple dots correctly", () => {
    const input = { "a.b.c.d": 1, "a.b.c.e": 2, "a.f": 3 };
    const expectedOutput = {
      a: {
        b: {
          c: {
            d: 1,
            e: 2,
          },
        },
        f: 3,
      },
    };
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should process non-dot notation keys before dot notation keys", () => {
    const input = { 
      "a.b": "dotted value",
      a: { b: "original", c: "preserved" }
    };
    const expectedOutput = {
      a: {
        b: "dotted value", // Should overwrite
        c: "preserved"     // Should be preserved
      }
    };
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle conflicts when intermediate path is not an object", () => {
    const input = {
      a: "string value",
      "a.b.c": "nested value"
    };
    const expectedOutput = {
      a: {
        b: {
          c: "nested value"
        }
      }
    };
    
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle null values as non-objects", () => {
    const input = {
      a: null,
      "a.b": "value"
    };
    const expectedOutput = {
      a: {
        b: "value"
      }
    };
    
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle array values correctly", () => {
    const input = {
      a: [1, 2, 3],
      "a.b": "value"
    };
    
    const expectedOutput = {
      a: {
        b: "value"
      }
    };
    
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle number values correctly", () => {
    const input = {
      a: 123,
      "a.b": "value"
    };
    
    const expectedOutput = {
      a: {
        b: "value"
      }
    };
    
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should handle boolean values correctly", () => {
    const input = {
      a: true,
      "a.b": "value"
    };
    
    const expectedOutput = {
      a: {
        b: "value"
      }
    };
    
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });

  it("should use Object.prototype.hasOwnProperty.call for safety", () => {
    // Test with an object that has hasOwnProperty as a property
    const input = Object.create(null);
    input["a.b"] = 1;
    input.hasOwnProperty = "malicious";
    
    const expectedOutput = {
      a: { b: 1 },
      hasOwnProperty: "malicious"
    };
    
    expect(convertDotNotation(input)).toEqual(expectedOutput);
  });
});