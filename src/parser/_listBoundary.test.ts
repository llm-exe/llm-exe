import { normalizeListLines } from "./_listBoundary";
import { LlmExeError } from "@/errors";

const ctx = { operation: "test.op", parser: "test" };

describe("normalizeListLines", () => {
  it("splits a multi-line unmarked input and trims whitespace", () => {
    const out = normalizeListLines("apple\nbanana\ncherry", ctx);
    expect(out.marked).toBe(false);
    expect(out.lines).toEqual(["apple", "banana", "cherry"]);
  });

  it("normalizes \\r\\n and \\r as line terminators", () => {
    const out = normalizeListLines("a\r\nb\rc", ctx);
    expect(out.lines).toEqual(["a", "b", "c"]);
  });

  it("strips empty lines after trimming", () => {
    const out = normalizeListLines("a\n   \n\nb\n", ctx);
    expect(out.lines).toEqual(["a", "b"]);
  });

  it("detects dash-marked lists and strips the marker", () => {
    const out = normalizeListLines("- one\n- two\n- three", ctx);
    expect(out.marked).toBe(true);
    expect(out.lines).toEqual(["one", "two", "three"]);
  });

  it("detects asterisk-marked lists", () => {
    const out = normalizeListLines("* one\n* two", ctx);
    expect(out.marked).toBe(true);
    expect(out.lines).toEqual(["one", "two"]);
  });

  it("detects numeric-marked lists", () => {
    const out = normalizeListLines("1. one\n2. two\n10. ten", ctx);
    expect(out.marked).toBe(true);
    expect(out.lines).toEqual(["one", "two", "ten"]);
  });

  it("detects bullet (•) marked lists", () => {
    const out = normalizeListLines("• one\n• two", ctx);
    expect(out.marked).toBe(true);
    expect(out.lines).toEqual(["one", "two"]);
  });

  it("throws parser.parse_failed with reason=empty_input when input is blank", () => {
    try {
      normalizeListLines("   \n\n   ", ctx);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      const err = e as LlmExeError;
      expect(err.code).toBe("parser.parse_failed");
      const context = err.context as Record<string, unknown>;
      expect(context.reason).toBe("empty_input");
      expect(context.operation).toBe("test.op");
      expect(context.parser).toBe("test");
      expect(context.inputLength).toBe("   \n\n   ".length);
    }
  });

  it("throws parser.parse_failed with reason=mixed_list_markers when markers are inconsistent", () => {
    try {
      normalizeListLines("- marked\nunmarked line\n- also marked", ctx);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      const err = e as LlmExeError;
      expect(err.code).toBe("parser.parse_failed");
      const context = err.context as Record<string, unknown>;
      expect(context.reason).toBe("mixed_list_markers");
      expect(context.operation).toBe("test.op");
      expect(context.parser).toBe("test");
    }
  });

  it("propagates the operation and parser identifiers from the supplied context", () => {
    try {
      normalizeListLines("", { operation: "Foo.parse", parser: "foo" });
      fail("Expected an error to be thrown");
    } catch (e) {
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("Foo.parse");
      expect(ctx.parser).toBe("foo");
    }
  });

  it("preserves the order of input lines", () => {
    const out = normalizeListLines("- c\n- a\n- b", ctx);
    expect(out.lines).toEqual(["c", "a", "b"]);
  });

  it("treats a single unmarked line as a valid (but unmarked) one-item list", () => {
    // It's the caller's responsibility (e.g. ListToArrayParser) to reject this
    // case if it's invalid — normalizeListLines itself just reports `marked: false`.
    const out = normalizeListLines("just one line", ctx);
    expect(out.marked).toBe(false);
    expect(out.lines).toEqual(["just one line"]);
  });
});
