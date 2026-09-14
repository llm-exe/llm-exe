import { effortTransform, geminiMajorVersion } from "@/llm/config/google/effort";

describe("google effort transform", () => {
  const run = (v: any, model: any) => {
    const output: Record<string, any> = {};
    const returned = effortTransform(v, { model }, output);
    return { returned, output };
  };

  describe("geminiMajorVersion", () => {
    it.each([
      ["gemini-2.5-flash", 2],
      ["gemini-3.5-flash-lite", 3],
      ["gemini-3-pro-preview", 3],
      ["gemini-10.0-flash", 10],
    ])("should read the major version of %s", (model, expected) => {
      expect(geminiMajorVersion(model)).toBe(expected);
    });

    it.each(["", "not-a-model", "gemini-flash", "gpt-4o", undefined as any])(
      "should return null for %s",
      (model) => {
        expect(geminiMajorVersion(model)).toBeNull();
      }
    );
  });

  describe("gemini 3.x (thinkingLevel)", () => {
    it.each([
      ["minimal", "minimal"],
      ["low", "low"],
      ["medium", "medium"],
      ["high", "high"],
    ])("should map effort %s to thinkingLevel %s", (effort, level) => {
      const { returned, output } = run(effort, "gemini-3.5-flash");
      expect(returned).toBeUndefined();
      expect(output).toEqual({
        "generationConfig.thinkingConfig.thinkingLevel": level,
      });
    });

    it.each([
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
    ])("should send thinkingLevel for the %s shorthand model", (model) => {
      // Regression for #781: every current shorthand fell outside the old
      // allowlist, so `effort` was silently dropped.
      expect(run("high", model).output).toEqual({
        "generationConfig.thinkingConfig.thinkingLevel": "high",
      });
    });

    it("should not send a thinking budget for gemini-3.x", () => {
      const { returned } = run("high", "gemini-3.5-flash");
      expect(returned).toBeUndefined();
    });
  });

  describe("gemini 2.5 (thinkingBudget)", () => {
    it.each([
      ["minimal", 1024],
      ["low", 1024],
      ["medium", 8192],
      ["high", 24576],
    ])("should map effort %s to a budget of %s", (effort, budget) => {
      const { returned, output } = run(effort, "gemini-2.5-pro");
      expect(returned).toBe(budget);
      expect(output).toEqual({});
    });

    it("should support dated 2.5 snapshots", () => {
      expect(run("medium", "gemini-2.5-flash-preview-05-20").returned).toBe(
        8192
      );
    });
  });

  describe("unsupported input", () => {
    it.each([
      ["gemini-2.0-flash", "no thinking support"],
      ["gemini-1.5-pro", "no thinking support"],
      ["gemini-2.4-flash", "not a 2.5 family model"],
      ["gpt-4o", "not a gemini model"],
      ["", "empty model"],
    ])("should return nothing for %s (%s)", (model) => {
      const { returned, output } = run("high", model);
      expect(returned).toBeUndefined();
      expect(output).toEqual({});
    });

    it.each([123, null, undefined, {}, ["high"], "max", "xhigh"])(
      "should return nothing for effort value %s",
      (value) => {
        const { returned, output } = run(value, "gemini-3.5-flash");
        expect(returned).toBeUndefined();
        expect(output).toEqual({});
      }
    );

    it("should tolerate a missing model", () => {
      const output: Record<string, any> = {};
      expect(effortTransform("high", {}, output)).toBeUndefined();
      expect(output).toEqual({});
    });
  });
});
