import { escapeTemplateString } from "@/utils/modules/escapeTemplateString";
import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";

describe("escapeTemplateString", () => {
  it("returns plain string unchanged", () => {
    expect(escapeTemplateString("hello world")).toBe("hello world");
  });

  it("escapes a single mustache opener", () => {
    expect(escapeTemplateString("hello {{name}}")).toBe("hello \\{{name}}");
  });

  it("escapes every mustache opener in the string", () => {
    expect(escapeTemplateString("{{a}} and {{b}} and {{c}}")).toBe(
      "\\{{a}} and \\{{b}} and \\{{c}}"
    );
  });

  it("returns non-string input unchanged", () => {
    expect(escapeTemplateString(undefined as any)).toBeUndefined();
    expect(escapeTemplateString(null as any)).toBeNull();
    expect(escapeTemplateString(42 as any)).toBe(42);
    expect(escapeTemplateString({} as any)).toEqual({});
  });

  it("escaped variable renders as literal after replaceTemplateString", () => {
    const escaped = escapeTemplateString("{{evil}}");
    expect(replaceTemplateString(`Hello ${escaped}`, { evil: "BAD" })).toBe(
      "Hello {{evil}}"
    );
  });

  it("escaped partial reference does not expand even when partial is registered", () => {
    const partials = [
      {
        template: "PARTIAL_CONTENT",
        name: "registeredPartial",
      },
    ];
    const escaped = escapeTemplateString("{{> registeredPartial}}");
    expect(replaceTemplateString(escaped, {}, { partials })).toBe(
      "{{> registeredPartial}}"
    );
  });

  it("escaped helper invocation does not execute even when helper is registered", () => {
    const helpers = [
      {
        handler: () => "HELPER_RAN",
        name: "registeredHelper",
      },
    ];
    const escaped = escapeTemplateString(
      "{{#registeredHelper}}inner{{/registeredHelper}}"
    );
    expect(replaceTemplateString(escaped, {}, { helpers })).toBe(
      "{{#registeredHelper}}inner{{/registeredHelper}}"
    );
  });

  it("preserves legitimate template variables outside escaped regions", () => {
    const userPart = escapeTemplateString("{{injected}}");
    const template = `User said: ${userPart} (greeted {{name}})`;
    expect(replaceTemplateString(template, { name: "Alice" })).toBe(
      "User said: {{injected}} (greeted Alice)"
    );
  });
});
