import {
  emitDeprecationWarning,
  deprecateShorthand,
  _resetDeprecationWarnings,
} from "./_utils.deprecationWarning";
import { configs } from "@/llm/config";
import { Config } from "@/types";

function makeConfig(
  key: string,
  deprecated?: Config<any>["deprecated"]
): Config<any> {
  return {
    key,
    provider: "google.chat",
    method: "POST",
    endpoint: "",
    headers: "{}",
    options: {},
    mapBody: {},
    transformResponse: () => ({} as any),
    deprecated,
  };
}

describe("_utils.deprecationWarning", () => {
  let warningSpy: jest.SpyInstance;

  beforeEach(() => {
    _resetDeprecationWarnings();
    warningSpy = jest.spyOn(process, "emitWarning").mockImplementation();
  });

  afterEach(() => {
    warningSpy.mockRestore();
  });

  describe("emitDeprecationWarning", () => {
    it("does nothing if config is not deprecated", () => {
      const config = makeConfig("google.chat.v1");
      emitDeprecationWarning(config);
      expect(warningSpy).not.toHaveBeenCalled();
    });

    it("emits a structured deprecation warning with type, code, and detail", () => {
      const config = makeConfig("google.chat.v1", {
        shorthand: "google.gemini-2.5-pro",
        message: "This model is deprecated",
      });
      config.options.model = { default: "gemini-2.5-pro" };
      emitDeprecationWarning(config);
      expect(warningSpy).toHaveBeenCalledTimes(1);
      const [message, options] = warningSpy.mock.calls[0];
      expect(message).toBe("This model is deprecated");
      expect(options.type).toBe("DeprecationWarning");
      expect(options.code).toBe("LLM_EXE_DEPRECATED");
      const detail = JSON.parse(options.detail);
      expect(detail.shorthand).toBe("google.gemini-2.5-pro");
      expect(detail.provider).toBe("google.chat");
    });

    it("includes optional executor context in detail when provided", () => {
      const config = makeConfig("google.chat.v1", {
        shorthand: "google.gemini-2.5-pro",
        message: "Deprecated",
      });
      emitDeprecationWarning(config, {
        executorName: "my-executor",
        traceId: "trace-123",
      });
      const detail = JSON.parse(warningSpy.mock.calls[0][1].detail);
      expect(detail.executorName).toBe("my-executor");
      expect(detail.traceId).toBe("trace-123");
    });

    it("dedups by shorthand, not by config.key", () => {
      // Two distinct shorthands sharing the same config.key — must produce two warnings.
      const flash = makeConfig("google.chat.v1", {
        shorthand: "google.gemini-2.5-flash",
        message: "Flash deprecated",
      });
      const pro = makeConfig("google.chat.v1", {
        shorthand: "google.gemini-2.5-pro",
        message: "Pro deprecated",
      });
      emitDeprecationWarning(flash);
      emitDeprecationWarning(pro);
      expect(warningSpy).toHaveBeenCalledTimes(2);
      expect(JSON.parse(warningSpy.mock.calls[0][1].detail).shorthand).toBe(
        "google.gemini-2.5-flash"
      );
      expect(JSON.parse(warningSpy.mock.calls[1][1].detail).shorthand).toBe(
        "google.gemini-2.5-pro"
      );
    });

    it("only warns once per shorthand across repeated calls", () => {
      const config = makeConfig("google.chat.v1", {
        shorthand: "google.gemini-2.5-flash",
        message: "Deprecated",
      });
      emitDeprecationWarning(config);
      emitDeprecationWarning(config);
      emitDeprecationWarning(config);
      expect(warningSpy).toHaveBeenCalledTimes(1);
    });

    it("silently no-ops when process.emitWarning is unavailable (non-Node runtime)", () => {
      const original = process.emitWarning;
      // @ts-expect-error simulating a runtime without process.emitWarning
      delete process.emitWarning;
      try {
        const config = makeConfig("google.chat.v1", {
          shorthand: "google.gemini-2.5-flash",
          message: "Deprecated",
        });
        expect(() => emitDeprecationWarning(config)).not.toThrow();
      } finally {
        process.emitWarning = original;
      }
    });
  });

  describe("deprecateShorthand", () => {
    it("returns a single-entry record keyed by the shorthand", () => {
      const base = makeConfig("google.chat.v1");
      const result = deprecateShorthand("google.gemini-2.5-pro", {
        config: base,
        message: "Deprecated",
      });
      expect(Object.keys(result)).toEqual(["google.gemini-2.5-pro"]);
    });

    it("stamps the shorthand onto the deprecated payload", () => {
      const base = makeConfig("google.chat.v1");
      const result = deprecateShorthand("google.gemini-2.5-pro", {
        config: base,
        message: "Deprecated",
      });
      expect(result["google.gemini-2.5-pro"].deprecated).toEqual({
        shorthand: "google.gemini-2.5-pro",
        message: "Deprecated",
      });
    });

    it("preserves all other config fields", () => {
      const base = makeConfig("google.chat.v1");
      const result = deprecateShorthand("google.gemini-2.5-pro", {
        config: base,
        message: "Deprecated",
      });
      const entry = result["google.gemini-2.5-pro"];
      expect(entry.key).toBe(base.key);
      expect(entry.provider).toBe(base.provider);
      expect(entry.method).toBe(base.method);
    });

    it("does not mutate the input config", () => {
      const base = makeConfig("google.chat.v1");
      deprecateShorthand("google.gemini-2.5-pro", {
        config: base,
        message: "Deprecated",
      });
      expect(base.deprecated).toBeUndefined();
    });

    it("freezes the deprecated payload so consumers can't poison it", () => {
      const base = makeConfig("google.chat.v1");
      const result = deprecateShorthand("google.gemini-2.5-pro", {
        config: base,
        message: "Deprecated",
      });
      const dep = result["google.gemini-2.5-pro"].deprecated!;
      expect(Object.isFrozen(dep)).toBe(true);
    });
  });

  describe("_resetDeprecationWarnings", () => {
    it("allows warnings to fire again after reset", () => {
      const config = makeConfig("google.chat.v1", {
        shorthand: "google.gemini-2.5-pro",
        message: "Deprecated",
      });
      emitDeprecationWarning(config);
      _resetDeprecationWarnings();
      emitDeprecationWarning(config);
      expect(warningSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("integration with real registry", () => {
    it("the retired Gemini shorthands each carry their own deprecated payload", () => {
      const shorthands = [
        "google.gemini-2.0-flash",
        "google.gemini-2.0-flash-lite",
        "google.gemini-1.5-pro",
      ] as const;
      for (const shorthand of shorthands) {
        const entry = (configs as any)[shorthand] as Config<any>;
        expect(entry.deprecated).toBeDefined();
        expect(entry.deprecated!.shorthand).toBe(shorthand);
      }
    });

    it("non-deprecated shorthands carry no deprecated payload", () => {
      const entry = (configs as any)["google.chat.v1"] as Config<any>;
      expect(entry.deprecated).toBeUndefined();
    });

    it("the Gemini 2.5 shorthands are not deprecated and emit no warning", () => {
      const shorthands = [
        "google.gemini-2.5-pro",
        "google.gemini-2.5-flash",
        "google.gemini-2.5-flash-lite",
      ] as const;
      for (const shorthand of shorthands) {
        const entry = (configs as any)[shorthand] as Config<any>;
        expect(entry).toBeDefined();
        expect(entry.deprecated).toBeUndefined();
        emitDeprecationWarning(entry);
      }
      expect(warningSpy).not.toHaveBeenCalled();
    });

    it("emits a distinct warning for each registry shorthand", () => {
      const flash = (configs as any)["google.gemini-2.0-flash"] as Config<any>;
      const pro = (configs as any)["google.gemini-1.5-pro"] as Config<any>;
      emitDeprecationWarning(flash);
      emitDeprecationWarning(pro);
      expect(warningSpy).toHaveBeenCalledTimes(2);
      const shorthands = warningSpy.mock.calls.map(
        (c) => JSON.parse(c[1].detail).shorthand
      );
      expect(shorthands).toContain("google.gemini-2.0-flash");
      expect(shorthands).toContain("google.gemini-1.5-pro");
    });
  });
});
