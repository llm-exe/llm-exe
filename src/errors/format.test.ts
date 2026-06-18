import {
  formatErrorValue,
  formatErrorList,
  formatLlmExeErrorForLog,
} from "./format";
import { LlmExeError } from "./LlmExeError";

describe("formatErrorValue", () => {
  it("double-quotes strings", () => {
    expect(formatErrorValue("hi")).toBe(`"hi"`);
  });

  it("does not quote numbers", () => {
    expect(formatErrorValue(7)).toBe("7");
    expect(formatErrorValue(3.14)).toBe("3.14");
  });

  it("does not quote booleans", () => {
    expect(formatErrorValue(true)).toBe("true");
    expect(formatErrorValue(false)).toBe("false");
  });

  it("does not quote null and undefined", () => {
    expect(formatErrorValue(null)).toBe("null");
    expect(formatErrorValue(undefined)).toBe("undefined");
  });

  it("truncates long strings", () => {
    const long = "a".repeat(500);
    const out = formatErrorValue(long);
    expect(out.length).toBeLessThanOrEqual(202);
    expect(out.endsWith("…\"")).toBe(true);
  });

  it("respects custom maxLength", () => {
    const out = formatErrorValue("hello world", { maxLength: 5 });
    expect(out).toBe(`"he…"`);
  });

  it("compact-JSONs objects", () => {
    expect(formatErrorValue({ a: 1, b: "x" })).toBe(`{"a":1,"b":"x"}`);
  });

  it("handles non-finite numbers", () => {
    expect(formatErrorValue(NaN)).toBe("null");
    expect(formatErrorValue(Infinity)).toBe("null");
  });

  it("handles circular objects safely", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const out = formatErrorValue(obj);
    expect(out).toContain("[Circular]");
  });

  it("falls back to [object Type] for unserializable values", () => {
    expect(formatErrorValue(Symbol("x"))).toContain("Symbol");
  });

  it("formats functions", () => {
    function namedFn() {}
    expect(formatErrorValue(namedFn)).toBe("[Function namedFn]");
    expect(formatErrorValue(() => {})).toContain("Function");
  });
});

describe("formatErrorList", () => {
  it("returns empty for empty list", () => {
    expect(formatErrorList([])).toBe("");
  });

  it("formats short lists", () => {
    expect(formatErrorList(["a", "b", "c"])).toBe(`"a", "b", "c"`);
  });

  it("caps at default 8 items with a truncation marker", () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const out = formatErrorList(items);
    expect(out).toContain("(4 more)");
  });

  it("respects custom maxItems", () => {
    const out = formatErrorList(["a", "b", "c", "d"], { maxItems: 2 });
    expect(out).toBe(`"a", "b", … (2 more)`);
  });
});

describe("formatLlmExeErrorForLog", () => {
  it("formats an LlmExeError with code", () => {
    const err = new LlmExeError("the message", {
      code: "parser.invalid_type",
    });
    expect(formatLlmExeErrorForLog(err)).toBe(
      "LlmExeError [parser.invalid_type]: the message"
    );
  });

  it("formats a plain Error", () => {
    expect(formatLlmExeErrorForLog(new Error("oops"))).toBe("Error: oops");
  });

  it("includes cause chain", () => {
    const root = new Error("root");
    const err = new LlmExeError("wrap", {
      code: "parser.invalid_type",
      cause: root,
    });
    const out = formatLlmExeErrorForLog(err);
    expect(out).toContain("LlmExeError [parser.invalid_type]: wrap");
    expect(out).toContain("Caused by: Error: root");
  });

  it("handles a cyclic cause chain", () => {
    const a: { name: string; message: string; cause?: unknown } = {
      name: "A",
      message: "a",
    };
    a.cause = a;
    const out = formatLlmExeErrorForLog(a);
    expect(out).toContain("[Circular]");
  });

  it("formats non-error values via formatErrorValue", () => {
    expect(formatLlmExeErrorForLog("just text")).toBe(`"just text"`);
    expect(formatLlmExeErrorForLog(42)).toBe("42");
  });

  it("uses category in the header when code is absent but category is present", () => {
    const err = {
      name: "WeirdError",
      message: "ouch",
      category: "parser",
    };
    expect(formatLlmExeErrorForLog(err)).toBe("WeirdError [parser]: ouch");
  });
});

describe("formatErrorValue throw-fallback path", () => {
  it("falls back to [object Tag] when JSON.stringify throws", () => {
    // A getter that throws causes JSON.stringify to throw; the catch block
    // returns undefined and the formatter falls through to the tag fallback.
    const obj = {
      get explode() {
        throw new Error("nope");
      },
    };
    const out = formatErrorValue(obj);
    expect(out).toBe("[object Object]");
  });
});

describe("formatErrorValue additional primitive coverage", () => {
  it("formats top-level bigint", () => {
    expect(formatErrorValue(42n)).toBe("42");
  });

  it("formats nested bigint inside an object via compactJson", () => {
    expect(formatErrorValue({ big: 9n })).toBe(`{"big":"9"}`);
  });

  it("formats nested function inside an object via compactJson", () => {
    expect(formatErrorValue({ fn: () => 1 })).toContain("[Function]");
  });

  it("formats nested symbol inside an object via compactJson", () => {
    expect(formatErrorValue({ sym: Symbol("x") })).toContain("Symbol(x)");
  });

  it("formats anonymous function with empty name", () => {
    const fn = function () {};
    Object.defineProperty(fn, "name", { value: "" });
    expect(formatErrorValue(fn)).toBe("[Function]");
  });
});

describe("formatErrorList additional coverage", () => {
  it("respects custom maxLength on each item", () => {
    const out = formatErrorList(["hello world", "another"], { maxLength: 6 });
    // maxLength is forwarded into formatErrorValue for each item
    expect(out).toContain("…");
  });
});

describe("formatLlmExeErrorForLog additional coverage", () => {
  it("falls back to Error name when name is missing", () => {
    const err = { message: "hi" };
    expect(formatLlmExeErrorForLog(err)).toBe("Error: hi");
  });

  it("falls back to empty message when message is not a string", () => {
    const err = { name: "MyError", message: 42 };
    expect(formatLlmExeErrorForLog(err)).toBe("MyError: ");
  });

  it("emits cause with code segment when cause has a code", () => {
    const cause = { name: "InnerError", message: "boom", code: "x.y" };
    const err = new LlmExeError("outer", {
      code: "parser.invalid_type",
      cause,
    });
    const out = formatLlmExeErrorForLog(err);
    expect(out).toContain("Caused by: InnerError [x.y]: boom");
  });

  it("stringifies the cause when message is not a string", () => {
    const cause = { name: "InnerError", message: 7, toString: () => "weird" };
    const err = new LlmExeError("outer", {
      code: "parser.invalid_type",
      cause,
    });
    const out = formatLlmExeErrorForLog(err);
    expect(out).toContain("Caused by: InnerError:");
  });

  it("falls back to Error name for nameless cause", () => {
    const cause = { message: "no name here" };
    const err = new LlmExeError("outer", {
      code: "parser.invalid_type",
      cause,
    });
    const out = formatLlmExeErrorForLog(err);
    expect(out).toContain("Caused by: Error: no name here");
  });
});
