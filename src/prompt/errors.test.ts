import { missingTemplateReferencesError } from "./errors";
import { LlmExeError } from "@/errors";

describe("missingTemplateReferencesError", () => {
  it("builds an LlmExeError with the prompt.missing_template_variable code", () => {
    const err = missingTemplateReferencesError({
      missingVariables: ["name"],
      missingHelpers: [],
    });

    expect(err).toBeInstanceOf(LlmExeError);
    expect(err.code).toBe("prompt.missing_template_variable");
    expect(err.category).toBe("prompt");
  });

  it("describes only the missing variables when no helpers are missing", () => {
    const err = missingTemplateReferencesError({
      missingVariables: ["name", "age"],
      missingHelpers: [],
    });
    expect(err.message).toContain(
      "Prompt template references variables not provided"
    );
    expect(err.message).toContain("name");
    expect(err.message).toContain("age");
    expect(err.message).not.toContain("helpers");
  });

  it("describes only the missing helpers when no variables are missing", () => {
    const err = missingTemplateReferencesError({
      missingVariables: [],
      missingHelpers: ["customFormatter"],
    });
    expect(err.message).toContain(
      "Prompt template references helpers not registered"
    );
    expect(err.message).toContain("customFormatter");
    expect(err.message).not.toContain("variables not provided");
  });

  it("describes both when variables and helpers are missing", () => {
    const err = missingTemplateReferencesError({
      missingVariables: ["v1"],
      missingHelpers: ["h1"],
    });
    expect(err.message).toContain("unresolved references");
    expect(err.message).toContain("v1");
    expect(err.message).toContain("h1");
  });

  it("preserves the missing-references context on the error", () => {
    const err = missingTemplateReferencesError({
      missingVariables: ["v"],
      missingHelpers: ["h"],
    });
    const context = err.context as Record<string, unknown>;
    expect(context.missingVariables).toEqual(["v"]);
    expect(context.missingHelpers).toEqual(["h"]);
  });

  it("attaches a resolution hint to the context", () => {
    const err = missingTemplateReferencesError({
      missingVariables: ["v"],
      missingHelpers: [],
    });
    const context = err.context as Record<string, unknown>;
    expect(typeof context.resolution).toBe("string");
    expect(String(context.resolution)).toMatch(/variable/i);
  });

  it("handles multiple items in each list", () => {
    const err = missingTemplateReferencesError({
      missingVariables: ["a", "b", "c"],
      missingHelpers: ["x", "y"],
    });
    expect(err.message).toContain("a");
    expect(err.message).toContain("b");
    expect(err.message).toContain("c");
    expect(err.message).toContain("x");
    expect(err.message).toContain("y");
  });
});
