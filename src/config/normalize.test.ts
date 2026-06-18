import { normalizeConfig, mergeData } from "./normalize";
import { isLlmExeError } from "@/errors";

const base = {
  provider: "openai.chat-mock.v1",
  message: "Summarize: {{text}}",
};

describe("mergeData", () => {
  it("returns base when override is undefined", () => {
    expect(mergeData({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("returns override (cloned) when base is undefined", () => {
    const override = { a: 1 };
    const result = mergeData(undefined, override);
    expect(result).toEqual({ a: 1 });
    expect(result).not.toBe(override);
  });

  it("merges plain objects recursively", () => {
    expect(
      mergeData({ a: { x: 1, y: 2 } }, { a: { y: 3, z: 4 } })
    ).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  it("replaces arrays rather than merging them", () => {
    expect(mergeData({ a: [1, 2, 3] }, { a: [9] })).toEqual({ a: [9] });
  });

  it("ignores undefined override values (does not clobber)", () => {
    expect(mergeData({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });

  it("lets null replace", () => {
    expect(mergeData({ a: 1 }, { a: null })).toEqual({ a: null });
  });

  it("strips __proto__ and does NOT pollute Object.prototype", () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
    const result = mergeData({ safe: 1 }, malicious);
    expect(({} as any).polluted).toBeUndefined();
    expect((result as any).polluted).toBeUndefined();
    expect(result).toEqual({ safe: 1 });
  });

  it("strips constructor/prototype keys at nested levels", () => {
    const malicious = JSON.parse(
      '{"a": {"constructor": {"bad": 1}, "prototype": {"bad": 2}, "ok": 3}}'
    );
    const result = mergeData({}, malicious) as any;
    expect(result.a).toEqual({ ok: 3 });
    expect(({} as any).bad).toBeUndefined();
  });
});

describe("normalizeConfig", () => {
  it("defaults parser to 'string'", () => {
    expect(normalizeConfig(base).parser).toBe("string");
  });

  it("accepts `output` as an alias for `parser`", () => {
    expect(normalizeConfig({ ...base, output: "json" }).parser).toBe("json");
  });

  it("prefers `parser` over `output` when both present", () => {
    expect(
      normalizeConfig({ ...base, parser: "json", output: "boolean" }).parser
    ).toBe("json");
  });

  it("strips the `output` key (additionalProperties is false)", () => {
    const result = normalizeConfig({ ...base, output: "json" }) as any;
    expect(result.output).toBeUndefined();
  });

  it("applies patch with caller > file precedence", () => {
    const result = normalizeConfig(base, { message: "Override" });
    expect(result.message).toBe("Override");
  });

  it("deep-merges patch.data over config.data", () => {
    const result = normalizeConfig(
      { ...base, data: { a: 1, nested: { x: 1 } } },
      { data: { nested: { y: 2 } } }
    );
    expect(result.data).toEqual({ a: 1, nested: { x: 1, y: 2 } });
  });

  it("throws invalid_config for an unknown provider", () => {
    expect.assertions(2);
    try {
      normalizeConfig({ ...base, provider: "not.a.real.provider" });
    } catch (error) {
      expect(isLlmExeError(error)).toBe(true);
      expect((error as any).code).toBe("configuration.invalid_config");
    }
  });

  it("throws invalid_config when message is missing", () => {
    try {
      normalizeConfig({ provider: "openai.chat-mock.v1" });
    } catch (error) {
      expect((error as any).code).toBe("configuration.invalid_config");
    }
  });

  it("throws invalid_config for a whitespace-only message", () => {
    try {
      normalizeConfig({ ...base, message: "   " });
    } catch (error) {
      expect((error as any).code).toBe("configuration.invalid_config");
    }
  });

  it("throws invalid_config when given a non-object", () => {
    try {
      normalizeConfig("not an object");
    } catch (error) {
      expect((error as any).code).toBe("configuration.invalid_config");
    }
  });
});
