import { serializeLlmExeError } from "./serialize";
import { LlmExeError } from "./LlmExeError";

describe("serializeLlmExeError", () => {
  it("returns null for null/undefined", () => {
    expect(serializeLlmExeError(null)).toBeNull();
    expect(serializeLlmExeError(undefined)).toBeNull();
  });

  it("serializes a primitive", () => {
    expect(serializeLlmExeError("just text")).toBe("just text");
    expect(serializeLlmExeError(42)).toBe(42);
    expect(serializeLlmExeError(true)).toBe(true);
  });

  it("serializes an LlmExeError with standard fields", () => {
    const err = new LlmExeError("the message", {
      code: "parser.invalid_type",
      context: { parser: "json" },
    });
    expect(serializeLlmExeError(err)).toEqual({
      name: "LlmExeError",
      message: "the message",
      category: "parser",
      code: "parser.invalid_type",
      context: { parser: "json" },
    });
  });

  it("includes cause chain", () => {
    const root = new Error("root cause");
    const wrapped = new LlmExeError("wrap", {
      code: "parser.invalid_type",
      cause: root,
    });
    const json = serializeLlmExeError(wrapped) as Record<string, unknown>;
    expect(json.cause).toEqual({
      name: "Error",
      message: "root cause",
    });
  });

  it("truncates cause chain past max depth", () => {
    const a = new Error("a");
    const b = new Error("b");
    const c = new Error("c");
    const d = new Error("d");
    const e = new Error("e");
    const f = new Error("f");
    (a as { cause?: unknown }).cause = b;
    (b as { cause?: unknown }).cause = c;
    (c as { cause?: unknown }).cause = d;
    (d as { cause?: unknown }).cause = e;
    (e as { cause?: unknown }).cause = f;

    const json = serializeLlmExeError(a) as Record<string, unknown>;
    expect(JSON.stringify(json)).toContain("truncated");
  });

  it("handles circular cause without throwing", () => {
    const a: { name: string; message: string; cause?: unknown } = {
      name: "A",
      message: "a",
    };
    a.cause = a;
    expect(() => serializeLlmExeError(a)).not.toThrow();
    const json = JSON.stringify(serializeLlmExeError(a));
    expect(json).toContain("[Circular]");
  });

  it("handles circular context without throwing", () => {
    const ctx: { parser: string; back?: unknown } = { parser: "json" };
    ctx.back = ctx;
    const err = new LlmExeError("x", {
      code: "parser.invalid_type",
      context: ctx as any,
    });
    const json = JSON.stringify(serializeLlmExeError(err));
    expect(json).toContain("[Circular]");
  });

  it("summarizes Buffer", () => {
    const buf = Buffer.from("hello");
    const out = serializeLlmExeError({
      name: "X",
      message: "x",
      cause: buf,
    });
    const json = JSON.stringify(out);
    expect(json).toContain("[Buffer length=5]");
  });

  it("summarizes Map and Set", () => {
    const set = new Set([1, 2]);
    const map = new Map([["a", 1]]);
    const out = serializeLlmExeError({
      name: "X",
      message: "x",
      cause: { set, map },
    }) as Record<string, unknown>;
    expect(JSON.stringify(out)).toContain("[object Set]");
    expect(JSON.stringify(out)).toContain("[object Map]");
  });

  it("summarizes function and symbol", () => {
    const fn = function named() {};
    const sym = Symbol("hello");
    const out = serializeLlmExeError({
      name: "X",
      message: "x",
      cause: { fn, sym },
    });
    expect(JSON.stringify(out)).toContain("[Function named]");
    expect(JSON.stringify(out)).toContain("Symbol(hello)");
  });

  it("serializes Date as ISO string", () => {
    const d = new Date("2024-01-01T00:00:00.000Z");
    const out = serializeLlmExeError({
      name: "X",
      message: "x",
      cause: { when: d },
    }) as Record<string, unknown>;
    expect(JSON.stringify(out)).toContain("2024-01-01T00:00:00.000Z");
  });

  it("serializes bigint as string", () => {
    const out = serializeLlmExeError({
      name: "X",
      message: "x",
      cause: { big: 12345678901234567890n },
    });
    expect(JSON.stringify(out)).toContain("12345678901234567890");
  });

  it("includes stack when includeStack is true", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    const withStack = serializeLlmExeError(err, {
      includeStack: true,
    }) as Record<string, unknown>;
    expect(typeof withStack.stack).toBe("string");
  });

  it("excludes stack by default", () => {
    const err = new LlmExeError("x", { code: "parser.invalid_type" });
    const noStack = serializeLlmExeError(err) as Record<string, unknown>;
    expect(noStack.stack).toBeUndefined();
  });

  it("serializes Response objects compactly", () => {
    const resp = new Response("body", { status: 429, statusText: "Too Many" });
    const out = serializeLlmExeError({
      name: "X",
      message: "wrap",
      cause: resp,
    }) as Record<string, unknown>;
    expect(out.cause).toEqual({
      name: "Response",
      status: 429,
      statusText: "Too Many",
      url: "",
    });
  });

  it("caps deep object traversal", () => {
    let obj: any = { leaf: "v" };
    for (let i = 0; i < 10; i++) {
      obj = { nested: obj };
    }
    const out = serializeLlmExeError({
      name: "X",
      message: "x",
      cause: obj,
    });
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("serializes a Response when it appears as a nested value (not the top-level error)", () => {
    if (typeof Response === "undefined") {
      return;
    }
    const response = new Response("body", {
      status: 503,
      statusText: "Down",
    });
    const err = new LlmExeError("wrapped", {
      code: "parser.parse_failed",
      context: { received: response },
    });
    const out = serializeLlmExeError(err) as Record<string, any>;
    expect(out.context.received).toEqual({
      name: "Response",
      status: 503,
      statusText: "Down",
      url: "",
    });
  });

  it("serializes a custom-class instance with own enumerable keys", () => {
    class CustomThing {
      constructor(public a: number, public b: string) {}
    }
    const err = new LlmExeError("wrapped", {
      code: "parser.parse_failed",
      context: { received: new CustomThing(1, "two") },
    });
    const out = serializeLlmExeError(err) as Record<string, any>;
    expect(out.context.received).toEqual({ a: 1, b: "two" });
  });

  it("collapses a custom-class instance with no own enumerable keys to its [object Object] tag", () => {
    class EmptyThing {}
    const err = new LlmExeError("wrapped", {
      code: "parser.parse_failed",
      context: { received: new EmptyThing() },
    });
    const out = serializeLlmExeError(err) as Record<string, any>;
    // Default `Object.prototype.toString.call` tag for any plain class without
    // Symbol.toStringTag is "Object" — describeOpaque returns "[object Object]".
    expect(out.context.received).toBe("[object Object]");
  });

  it("preserves the Symbol.toStringTag for a custom-class instance with no own keys", () => {
    class Tagged {
      get [Symbol.toStringTag]() {
        return "Tagged";
      }
    }
    const err = new LlmExeError("wrapped", {
      code: "parser.parse_failed",
      context: { received: new Tagged() },
    });
    const out = serializeLlmExeError(err) as Record<string, any>;
    expect(out.context.received).toBe("[object Tagged]");
  });

  it("truncates a generic Error-like cause chain that exceeds MAX_CAUSE_DEPTH", () => {
    // MAX_CAUSE_DEPTH = 5. Build a 6-deep chain so the truncation marker fires.
    let chain: any = { name: "Leaf", message: "leaf" };
    for (let i = 0; i < 6; i++) {
      chain = { name: "Wrap", message: `wrap ${i}`, cause: chain };
    }
    const out = serializeLlmExeError(chain) as any;
    let walker = out;
    // Five hops descend through Wrap layers before the cap fires on the next cause.
    for (let i = 0; i < 4; i++) {
      walker = walker.cause;
    }
    expect(walker.cause).toEqual({ truncated: true });
  });

  it("truncates an LlmExeError cause chain that exceeds MAX_CAUSE_DEPTH", () => {
    let chain: any = new LlmExeError("leaf", { code: "parser.parse_failed" });
    for (let i = 0; i < 6; i++) {
      chain = new LlmExeError(`wrap ${i}`, {
        code: "parser.parse_failed",
        cause: chain,
      });
    }
    const out = serializeLlmExeError(chain) as any;
    let walker = out;
    for (let i = 0; i < 4; i++) {
      walker = walker.cause;
    }
    expect(walker.cause).toEqual({ truncated: true });
  });

  it("safeValue iterates arrays passed in context", () => {
    const err = new LlmExeError("with array", {
      code: "parser.parse_failed",
      context: { input: [1, "two", { three: 3 }] },
    });
    const out = serializeLlmExeError(err) as Record<string, any>;
    expect(out.context.input).toEqual([1, "two", { three: 3 }]);
  });

  it("includes stack on a generic Error-like value when includeStack is true", () => {
    const plainErr = {
      name: "TypeError",
      message: "boom",
      stack: "TypeError: boom\n    at synthetic\n",
    };
    const out = serializeLlmExeError(plainErr, { includeStack: true }) as Record<
      string,
      any
    >;
    expect(out.name).toBe("TypeError");
    expect(out.stack).toBe(plainErr.stack);
  });

  it("nullifies non-finite numbers in context", () => {
    const err = new LlmExeError("nan", {
      code: "parser.parse_failed",
      context: { broken: NaN, inf: Infinity } as any,
    });
    const out = serializeLlmExeError(err) as any;
    expect(out.context.broken).toBeNull();
    expect(out.context.inf).toBeNull();
  });

  it("describes anonymous functions in context as [Function]", () => {
    const fn = function () {};
    Object.defineProperty(fn, "name", { value: "" });
    const err = new LlmExeError("fn", {
      code: "parser.parse_failed",
      context: { fn } as any,
    });
    const out = serializeLlmExeError(err) as any;
    expect(out.context.fn).toBe("[Function]");
  });

  it("nullifies an invalid Date in context", () => {
    const err = new LlmExeError("d", {
      code: "parser.parse_failed",
      context: { when: new Date("not-a-date") } as any,
    });
    const out = serializeLlmExeError(err) as any;
    expect(out.context.when).toBeNull();
  });

  it("skips undefined values on a plain-object context", () => {
    const err = new LlmExeError("u", {
      code: "parser.parse_failed",
      context: { a: 1, b: undefined, c: 2 } as any,
    });
    const out = serializeLlmExeError(err) as any;
    expect(out.context).toEqual({ a: 1, c: 2 });
  });

  it("skips undefined own-keys on a custom-class context", () => {
    class CustomThing {
      constructor(public a: number, public b: undefined, public c: number) {}
    }
    const err = new LlmExeError("u", {
      code: "parser.parse_failed",
      context: { received: new CustomThing(1, undefined, 3) } as any,
    });
    const out = serializeLlmExeError(err) as any;
    expect(out.context.received).toEqual({ a: 1, c: 3 });
  });

  it("falls back to safe defaults when an LlmExeError-like value has non-string fields", () => {
    const fake = {
      isLlmExeError: true,
      message: 42,
      category: 99,
      code: {},
    };
    const out = serializeLlmExeError(fake) as any;
    expect(out.name).toBe("LlmExeError");
    expect(out.message).toBe("");
    expect(out.category).toBe("unknown");
    expect(out.code).toBe("unknown.unclassified");
  });

  it("returns null for a non-finite number passed as the top-level error", () => {
    expect(serializeLlmExeError(NaN)).toBeNull();
  });

  it("falls back to Error name for a top-level error-like value with no name", () => {
    const errLike = { message: "no name", name: "" };
    const out = serializeLlmExeError(errLike) as any;
    expect(out.name).toBe("Error");
    expect(out.message).toBe("no name");
  });

  it("returns empty message string when a generic error-like message is non-string", () => {
    const errLike = { name: "Boom", message: 42 };
    // isErrorLike requires both message and name as strings, so this falls through
    // to the freshSafeValue branch and ends up as a plain serialized object.
    const out = serializeLlmExeError(errLike) as any;
    expect(out).toEqual({ name: "Boom", message: 42 });
  });

  it("serializes a null context field to null", () => {
    // context is present (not undefined) but null — it should round-trip as null
    // rather than being dropped or throwing.
    const fake = {
      isLlmExeError: true,
      message: "boom",
      category: "parser",
      code: "parser.parse_failed",
      context: null,
    };
    const out = serializeLlmExeError(fake) as any;
    expect(out.context).toBeNull();
  });

  it("preserves null values nested inside context objects and arrays", () => {
    const err = new LlmExeError("nested nulls", {
      code: "parser.parse_failed",
      context: { received: null, list: [1, null, undefined, "x"] } as any,
    });
    const out = serializeLlmExeError(err) as any;
    expect(out.context.received).toBeNull();
    // Array holes/undefined become null (arrays are not compacted like objects).
    expect(out.context.list).toEqual([1, null, null, "x"]);
  });
});
