import { filterObjectOnSchema } from "./filterObjectOnSchema";

describe("filterObjectOnSchema", function () {
  var schema = {
    title: "Example Schema",
    type: "object",
    properties: {
      firstName: {
        type: "string",
      },
      lastName: {
        type: "string",
      },
      age: {
        description: "Age in years",
        type: "integer",
        minimum: 0,
      },
      isLive: {
        description: "Live or dead",
        type: "boolean",
      },
      general: {
        type: "object",
        required: false,
      },
      generalWithProperties: {
        type: ["object", "null"],
        required: false,
        properties: {
          randomField: {
            type: "string",
          },
        },
      },
      contacts: {
        type: "array",
        id: "http://jsonschema.net/contacts",
        required: false,
        items: {
          type: "object",
          id: "http://jsonschema.net/contacts/0",
          required: false,
          properties: {
            phone: {
              type: "string",
              required: false,
            },
          },
        },
      },
      hobbies: {
        type: "array",
        required: false,
        items: {
          type: "string",
        },
      },
      boolField: {
        type: ["boolean", "null"],
      },
      nullableObjectField: {
        type: ["object", "null"],
        properties: {
          validField: {
            type: "string",
          },
        },
      },
      nullableArrayField: {
        type: ["array", "null"],
        items: {
          type: "object",
          properties: {
            validField: {
              type: "string",
            },
          },
        },
      },
    },
    required: ["firstName", "lastName"],
  };

  it("filters the document with no exclusions", function () {
    var document = {
      firstName: "Andrew",
      lastName: "Lank",
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual(document);
  });

  it("excludes non schema defined objects", function () {
    var document = {
      firstName: "Andrew",
      lastName: "Lank",
      age: 0,
      isLive: false,
      thisOne: "should not appear in results",
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      lastName: "Lank",
      age: 0,
      isLive: false,
    });
  });

  it("coerces true and false boolean strings without treating false as truthy", function () {
    var document = {
      firstName: "Andrew",
      lastName: "Lank",
      isLive: "false",
      boolField: "true",
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      lastName: "Lank",
      isLive: false,
      boolField: true,
    });
  });

  it("preserves invalid boolean strings for schema validation to reject later", function () {
    var document = {
      firstName: "Andrew",
      lastName: "Lank",
      isLive: "maybe",
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      lastName: "Lank",
      isLive: "maybe",
    });
  });

  it("excludes non schema defined array objects", function () {
    var document = {
      firstName: "Andrew",
      contacts: [
        { phone: "5146666666" },
        { phone: "5148888888", shouldNot: "see this" },
      ],
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
    });
  });

  it("accepts free form objects", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {
        hobbies: ["cylcing", "jogging", "death"],
        drinking_abilities: "professional",
      },
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual(document);
  });

  it("accepts free form objects, still include empty object", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {},
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {},
    });
  });

  it("accepts free form objects that are absent", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual(document);
  });

  it("detach free form objects when detachFreeForm is true", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {
        hobbies: ["cylcing", "jogging", "death"],
        drinking_abilities: "professional",
      },
    };

    var result = filterObjectOnSchema(schema, document, true);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {},
    });
  });

  it("detach free form objects when detachFreeForm is true, even for empty objects", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {},
    };

    var result = filterObjectOnSchema(schema, document, true);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      general: {},
    });
  });

  it("filters array literals", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, { phone: "5148888888" }],
      hobbies: [
        "driving",
        "working",
        "working harder",
        "wish I wasn't working",
      ],
    };

    var results = filterObjectOnSchema(schema, document);

    expect(results).toEqual(document);
  });

  it("does not filter out null fields", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, NaN],
      generalWithProperties: null,
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, NaN],
      generalWithProperties: null,
    });
  });

  it("ignores non-objects when expecting objects", function () {
    var document = {
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, NaN],
      general: null,
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: [{ phone: "5146666666" }, NaN],
      general: null,
    });
  });

  it("ignores non-arrays when expecting arrays", function () {
    var document = {
      firstName: "Andrew",
      contacts: 123,
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({ firstName: "Andrew", contacts: 123 });
  });

  it("does not filter falsey types when type is an array of types", function () {
    var document = {
      firstName: "Andrew",
      contacts: 123,
      boolField: false,
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: 123,
      boolField: false,
    });
  });

  it('filters fields properly when type is ["object", "null"]', function () {
    var document = {
      firstName: "Andrew",
      contacts: 123,
      boolField: false,
      nullableObjectField: {
        validField: "foo",
        invalidField: "bar",
      },
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: 123,
      boolField: false,
      nullableObjectField: { validField: "foo" },
    });
  });

  it('filters fields properly when type is ["array", "null"]', function () {
    var document = {
      firstName: "Andrew",
      contacts: 123,
      boolField: false,
      nullableArrayField: [
        {
          validField: "foo",
          invalidField: "bar",
        },
      ],
    };

    var result = filterObjectOnSchema(schema, document);

    expect(result).toEqual({
      firstName: "Andrew",
      contacts: 123,
      boolField: false,
      nullableArrayField: [{ validField: "foo" }],
    });
  });
});
