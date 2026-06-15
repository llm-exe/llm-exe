import { removeEmptyFromObject } from "./removeEmptyFromObject";
import { LlmExeError } from "@/errors";

describe("removeEmptyFromObject", () => {
    test("should return the same object if no empty values are found", () => {
      const obj = { name: "John", age: 30, city: "New York" };
      expect(removeEmptyFromObject(obj)).toEqual(obj);
    });
  
    test("should remove empty values from the object", () => {
      const obj = { name: "John", age: null, city: "", address: "" };
      expect(removeEmptyFromObject(obj)).toEqual({ name: "John", city: "", address: "" });
    });
  
    test("should remove empty values from nested objects", () => {
      const obj = { name: "John", age: null, city: "", address: { street: "", zip: "12345" } };
      expect(removeEmptyFromObject(obj)).toEqual({ name: "John", city: "", address: { street: "",zip: "12345" } });
    });
  
    test("should remove empty values from mixed data types", () => {
      const obj = { name: "John", age: null, city: "", address: { street: "", zip: "12345" }, hobbies: [], job: undefined };
      expect(removeEmptyFromObject(obj)).toEqual({ name: "John", city: "", address: { street: "", zip: "12345" }, hobbies: []});
    });
  
    test("should throw an error for invalid input", () => {
      expect(() => {
        removeEmptyFromObject("invalidInput" as any);
      }).toThrow("invalid object");
    });

    test("throws LlmExeError with template.invalid_helper_arguments for non-objects", () => {
      try {
        removeEmptyFromObject("invalidInput" as any);
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("template.invalid_helper_arguments");
        expect((e as LlmExeError).category).toBe("template");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("removeEmptyFromObject");
        expect(ctx.expected).toBe("object");
        expect(ctx.received).toBe("string");
      }
    });

    test("throws LlmExeError with received='null' for null input", () => {
      try {
        removeEmptyFromObject(null as any);
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.received).toBe("null");
      }
    });
  });