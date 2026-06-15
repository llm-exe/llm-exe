import { debug } from "./debug";

describe("debug", () => {
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let originalDebugEnv: string | undefined;

  beforeEach(() => {
    originalDebugEnv = process.env.LLM_EXE_DEBUG;
    debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    errorSpy.mockRestore();
    if (originalDebugEnv === undefined) {
      delete process.env.LLM_EXE_DEBUG;
    } else {
      process.env.LLM_EXE_DEBUG = originalDebugEnv;
    }
  });

  describe("when LLM_EXE_DEBUG is set", () => {
    beforeEach(() => {
      process.env.LLM_EXE_DEBUG = "true";
    });

    it("logs string arguments", () => {
      debug("hello world");
      expect(debugSpy).toHaveBeenCalledWith("hello world");
    });

    it("logs plain objects as JSON", () => {
      debug({ foo: "bar" });
      expect(debugSpy).toHaveBeenCalledWith(
        JSON.stringify({ foo: "bar" }, null, 2)
      );
    });

    it("redacts Authorization headers in objects", () => {
      debug({
        headers: {
          Authorization: "Bearer sk-1234567890abcdefghijklmnop",
        },
      });
      const loggedStr = debugSpy.mock.calls[0][0];
      expect(loggedStr).not.toContain("sk-1234567890abcdefghijklmnop");
      expect(loggedStr).toContain("[redacted]");
    });

    it("redacts Anthropic-style lowercase x-api-key inside object args", () => {
      // Anthropic's config sends `x-api-key`, not Authorization. The previous
      // Authorization-only conditional missed this entire shape.
      debug({
        headers: {
          "x-api-key": "sk-ant-syntheticAnthropicTokenAAAA",
        },
      });
      const loggedStr = debugSpy.mock.calls[0][0];
      expect(loggedStr).not.toContain("sk-ant-syntheticAnthropicTokenAAAA");
    });

    it("redacts secrets in objects even when no headers field is present", () => {
      debug({ apiKey: "sk-syntheticBareApiKeyAAAAAAAAAA" });
      const loggedStr = debugSpy.mock.calls[0][0];
      expect(loggedStr).not.toContain("sk-syntheticBareApiKeyAAAAAAAAAA");
    });

    it("leaves non-secret object content intact", () => {
      debug({ headers: { "Content-Type": "application/json" } });
      const loggedStr = debugSpy.mock.calls[0][0];
      expect(loggedStr).toContain("application/json");
    });

    it("logs arrays as stringified items", () => {
      debug([1, 2, 3]);
      const logged = debugSpy.mock.calls[0][0];
      expect(logged).toEqual(["1", "2", "3"]);
    });

    it("logs Map entries", () => {
      const map = new Map([["key1", "val1"]]);
      debug(map);
      const logged = debugSpy.mock.calls[0][0];
      expect(logged).toEqual(['key1: "val1"']);
    });

    it("logs Set values as stringified items", () => {
      const set = new Set(["a", "b"]);
      debug(set);
      const logged = debugSpy.mock.calls[0][0];
      expect(logged).toEqual(['"a"', '"b"']);
    });

    it("logs Date as ISO string", () => {
      const date = new Date("2024-01-15T12:00:00.000Z");
      debug(date);
      expect(debugSpy).toHaveBeenCalledWith("2024-01-15T12:00:00.000Z");
    });

    it("logs RegExp as string", () => {
      debug(/test-pattern/gi);
      expect(debugSpy).toHaveBeenCalledWith("/test-pattern/gi");
    });

    it("handles Error objects silently", () => {
      debug(new Error("test error"));
      // Error objects are skipped (nothing pushed to logs)
      expect(debugSpy).toHaveBeenCalledWith();
    });

    it("logs non-object, non-string values as-is", () => {
      debug(42);
      expect(debugSpy).toHaveBeenCalledWith(42);
    });

    it("logs null as-is", () => {
      debug(null);
      expect(debugSpy).toHaveBeenCalledWith(null);
    });

    it("logs undefined as-is", () => {
      debug(undefined);
      expect(debugSpy).toHaveBeenCalledWith(undefined);
    });

    it("logs multiple arguments together", () => {
      debug("prefix", { key: "val" }, 123);
      expect(debugSpy).toHaveBeenCalledWith(
        "prefix",
        JSON.stringify({ key: "val" }, null, 2),
        123
      );
    });

    it("handles objects that fail JSON.stringify", () => {
      const circular: any = {};
      circular.self = circular;
      debug(circular);
      expect(errorSpy).toHaveBeenCalledWith(
        "Error parsing object:",
        expect.any(Error)
      );
    });
  });

  describe("when LLM_EXE_DEBUG is not set or falsy", () => {
    it("does not log when LLM_EXE_DEBUG is unset", () => {
      delete process.env.LLM_EXE_DEBUG;
      debug("should not log");
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("does not log when LLM_EXE_DEBUG is empty string", () => {
      process.env.LLM_EXE_DEBUG = "";
      debug("should not log");
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("does not log when LLM_EXE_DEBUG is 'undefined'", () => {
      process.env.LLM_EXE_DEBUG = "undefined";
      debug("should not log");
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("does not log when LLM_EXE_DEBUG is 'null'", () => {
      process.env.LLM_EXE_DEBUG = "null";
      debug("should not log");
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it("is case-insensitive for 'undefined' and 'null' checks", () => {
      process.env.LLM_EXE_DEBUG = "UNDEFINED";
      debug("should not log");
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });
});
