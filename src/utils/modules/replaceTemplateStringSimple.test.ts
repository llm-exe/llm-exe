import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";

describe("replaceTemplateStringSimple", () => {
  it("should replace template string with context values", () => {
    const template = "Hello, {{ name }}!";
    const context = { name: "Alice" };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Hello, Alice!");
  });

  it("should handle nested properties in context", () => {
    const template = "User: {{ user.name }}, Age: {{ user.age }}";
    const context = { user: { name: "Bob", age: 30 } };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("User: Bob, Age: 30");
  });

  it("should return empty string if property is not found in context", () => {
    const template = "Hello, {{ unknown }}!";
    const context = { name: "Alice" };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Hello, !");
  });

  it("should handle missing nested properties by returning empty string", () => {
    const template = "User: {{ user.name }}, Address: {{ user.address.street }}";
    const context = { user: { name: "Bob" } };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("User: Bob, Address: ");
  });

  it("should handle non-string context properties", () => {
    const template = "Count: {{ count }}";
    const context = { count: 42 };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Count: 42");
  });

  it("should preserve spaces within template brackets", () => {
    const template = "Hello, {{   name    }}!";
    const context = { name: "Alice" };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Hello, Alice!");
  });

  it("should work with no placeholders", () => {
    const template = "Hello, World!";
    const context = {};
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Hello, World!");
  });

  it("should handle multiple placeholders", () => {
    const template = "Name: {{ name }}, Age: {{ age }}";
    const context = { name: "Charlie", age: 25 };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Name: Charlie, Age: 25");
  });

  it("should handle context values of different types", () => {
    const template = "String: {{ str }}, Number: {{ num }}, Boolean: {{ bool }}";
    const context = { str: "test", num: 123, bool: true };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("String: test, Number: 123, Boolean: true");
  });

  it("should not fail when context is an empty object", () => {
    const template = "Hello, {{ name }}!";
    const context = {};
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Hello, !");
  });

  it("should return empty string when template contains invalid key", () => {
    const template = "Hello, {{ invalid.key }}!";
    const context = { name: "Alice" };
    const result = replaceTemplateStringSimple(template, context);
    expect(result).toBe("Hello, !");
  });

  describe("encodeKeys (URL-encode selected placeholders) — issue #722", () => {
    it("URL-encodes only the listed key (e.g. an ARN model id in a path)", () => {
      const template =
        "https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke";
      const context = {
        awsRegion: "us-west-2",
        model:
          "arn:aws:bedrock:us-east-1:123:inference-profile/us.anthropic.claude-opus-4-8-v1:0",
      };
      const result = replaceTemplateStringSimple(template, context, {
        encodeKeys: ["model"],
      });
      expect(result).toBe(
        "https://bedrock-runtime.us-west-2.amazonaws.com/model/arn%3Aaws%3Abedrock%3Aus-east-1%3A123%3Ainference-profile%2Fus.anthropic.claude-opus-4-8-v1%3A0/invoke"
      );
      // awsRegion (not listed) is untouched
      expect(result).toContain("bedrock-runtime.us-west-2.amazonaws.com");
    });

    it("is a no-op for a plain model id with no reserved characters", () => {
      const result = replaceTemplateStringSimple(
        "/model/{{model}}/invoke",
        { model: "us.anthropic.claude-sonnet-4-6" },
        { encodeKeys: ["model"] }
      );
      expect(result).toBe("/model/us.anthropic.claude-sonnet-4-6/invoke");
    });

    it("never encodes an unlisted full-URL placeholder like {{baseUrl}}", () => {
      const result = replaceTemplateStringSimple(
        "{{baseUrl}}/embeddings",
        { baseUrl: "https://api.openai.com/v1" },
        { encodeKeys: ["model"] }
      );
      expect(result).toBe("https://api.openai.com/v1/embeddings");
    });

    it("does not encode anything when encodeKeys is omitted (backward compatible)", () => {
      const result = replaceTemplateStringSimple("/model/{{model}}/invoke", {
        model: "a/b:c",
      });
      expect(result).toBe("/model/a/b:c/invoke");
    });
  });
});