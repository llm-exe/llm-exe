import { readFileSync } from "fs";
import { join } from "path";
import { defineSchema } from "@/utils/modules/defineSchema";
import { createParser } from "@/parser";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

describe("defineSchema", () => {
  it("should handle null", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        name: { type: "string", default: "none" },
        age: { type: "integer", default: 0 },
      },
      required: ["age", "name"],
      additionalProperties: false,
    });

    expect(schema.additionalProperties).toEqual(false);
  });

  it("returns the same object and forces additionalProperties to false", () => {
    const input = {
      type: "object",
      properties: { a: { type: "string" } },
    } as const;
    const schema = defineSchema(input as any);
    expect(schema).toBe(input);
    expect((schema as any).additionalProperties).toBe(false);
  });

  it("narrows the schema to literal types (#947)", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        answer: { type: "string" },
        action: { type: "string" },
      },
      required: ["answer", "action"],
    });

    const typeCheck: Equals<typeof schema.type, "object"> = true;
    const requiredCheck: Equals<
      typeof schema.required,
      ["answer", "action"]
    > = true;
    expect(typeCheck).toBe(true);
    expect(requiredCheck).toBe(true);
  });

  it("json parser output is inferred from a defineSchema schema (#947)", () => {
    const schema = defineSchema({
      type: "object",
      properties: {
        answer: { type: "string" },
        action: { type: "string" },
      },
      required: ["answer", "action"],
    });
    const parser = createParser("json", { schema });
    const result = parser.parse(
      JSON.stringify({ answer: "yes", action: "go" })
    );

    const notUnknown: Equals<typeof result, unknown> = false;
    const check: Equals<
      Pick<typeof result, "answer" | "action">,
      { answer: string; action: string }
    > = true;
    expect(notUnknown).toBe(false);
    expect(check).toBe(true);
    // compile-time: these would fail if result were `unknown`
    expect(result.answer.toUpperCase()).toBe("YES");
    expect(result.action).toBe("go");
  });

  it("does not deep-import json-schema-to-ts internals (breaks nodenext consumers, #947)", () => {
    const source = readFileSync(join(__dirname, "defineSchema.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']json-schema-to-ts\/lib/);
  });
});
