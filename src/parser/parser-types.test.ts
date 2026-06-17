import { JsonParser, ListToJsonParser, createParser } from "@/parser";
import { ParserOutput } from "@/types";
import { defineSchema } from "@/utils/modules/defineSchema";

const schema = defineSchema({
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
  additionalProperties: false,
});

function acceptJsonOutput(value: ParserOutput<JsonParser<typeof schema>>) {
  return value;
}

function acceptListToJsonOutput(value: ParserOutput<ListToJsonParser<typeof schema>>) {
  return value;
}

describe("llm-exe:parser/type inference", () => {
  it("preserves schema-derived output types for schema-aware parsers", () => {
    expect(acceptJsonOutput({ name: "Greg", age: 42 })).toEqual({
      name: "Greg",
      age: 42,
    });
    expect(acceptListToJsonOutput({ name: "Greg", age: 42 })).toEqual({
      name: "Greg",
      age: 42,
    });
  });

  it("preserves schema inference through createParser", () => {
    const jsonParser = createParser("json", { schema });
    const listToJsonParser = createParser("listToJson", { schema });

    function acceptCreatedJsonOutput(value: ParserOutput<typeof jsonParser>) {
      return value;
    }

    function acceptCreatedListToJsonOutput(
      value: ParserOutput<typeof listToJsonParser>
    ) {
      return value;
    }

    expect(acceptCreatedJsonOutput({ name: "Greg", age: 42 })).toEqual({
      name: "Greg",
      age: 42,
    });
    expect(acceptCreatedListToJsonOutput({ name: "Greg", age: 42 })).toEqual({
      name: "Greg",
      age: 42,
    });

    if (false) {
      // @ts-expect-error age must remain a number from the schema.
      acceptCreatedJsonOutput({ name: "Greg", age: "42" });
      // @ts-expect-error missing required schema field.
      acceptCreatedListToJsonOutput({ name: "Greg" });
    }
  });
});
