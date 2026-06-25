import { getErrorMetadata } from "./getErrorMetadata";
import { LlmExeError } from "./LlmExeError";

describe("getErrorMetadata", () => {
  it("returns an empty object for null", () => {
    expect(getErrorMetadata(null)).toEqual({});
  });

  it("returns an empty object for undefined", () => {
    expect(getErrorMetadata(undefined)).toEqual({});
  });

  it("returns an empty object for a primitive", () => {
    expect(getErrorMetadata("nope")).toEqual({});
    expect(getErrorMetadata(42)).toEqual({});
    expect(getErrorMetadata(true)).toEqual({});
  });

  it("returns an empty object for a plain Error (not LlmExeError)", () => {
    expect(getErrorMetadata(new Error("boom"))).toEqual({});
  });

  it("returns an empty object for an arbitrary object", () => {
    expect(getErrorMetadata({ foo: "bar" })).toEqual({});
  });

  it("projects category/code/context for an LlmExeError without cause", () => {
    const err = new LlmExeError("missing", {
      code: "parser.invalid_type",
      context: { parser: "json" },
    });

    const out = getErrorMetadata(err);
    expect(out.errorCategory).toBe("parser");
    expect(out.errorCode).toBe("parser.invalid_type");
    expect(out.errorContext).toEqual({ parser: "json" });
    // cause property is always present on the projection (may be undefined).
    expect(out).toHaveProperty("errorCause");
    expect(out.errorCause).toBeUndefined();
  });

  it("projects the cause when one is provided", () => {
    const root = new Error("root");
    const err = new LlmExeError("wrap", {
      code: "parser.parse_failed",
      cause: root,
    });
    const out = getErrorMetadata(err);
    expect(out.errorCause).toBe(root);
  });

  it("can be spread unconditionally without overwriting unrelated keys", () => {
    const base = { traceId: "abc", existing: "keep" };
    const projected = getErrorMetadata("not an error");
    const merged = { ...base, ...projected };
    expect(merged).toEqual({ traceId: "abc", existing: "keep" });
  });
});
