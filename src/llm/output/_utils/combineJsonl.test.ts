import { combineJsonl } from "./combineJsonl";
import { CombinedJsonLResult } from "@/interfaces";
import { LlmExeError } from "@/errors";

describe("combineJsonl", () => {
  it("correctly combines, sorts, decodes content, and selects the final line", () => {
    const jsonl = `
      {"created_at":"2023-01-02T10:00:00Z","done":false,"message":{"role":"assistant","content":"Hello "}}
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"role":"assistant","content":"\\u003cWorld\\u003e"}}
      {"created_at":"2023-01-03T11:00:00Z","done":true,"model":"gpt-4","done_reason":"completed","message":{"role":"assistant","content":" final"},"total_duration":5000}
    `;

    const result: CombinedJsonLResult = combineJsonl(jsonl);

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].created_at).toBe("2023-01-01T09:00:00Z");
    expect(result.lines[1].created_at).toBe("2023-01-02T10:00:00Z");
    expect(result.lines[2].created_at).toBe("2023-01-03T11:00:00Z");

    expect(result.result.message.content).toBe("<World>Hello  final");
    expect(result.content.text).toBe("<World>Hello  final");
    expect(result.result.model).toBe("gpt-4");
    expect(result.result.done_reason).toBe("completed");
    expect(result.result.total_duration).toBe(5000);
  });

  it("throws if no done=true line found", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"content":"First line"}}
      {"created_at":"2023-01-02T10:00:00Z","done":false,"message":{"content":"Second line"}}
    `;

    expect(() => combineJsonl(jsonl)).toThrow("No line found where done = true.");
  });

  it("defaults message role to 'assistant' if missing", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"role":"assistant","content":"Hello "}}
      {"created_at":"2023-01-02T10:00:00Z","done":true,"model":"gpt-3.5","message":{"content":"World"}}
    `;

    const result = combineJsonl(jsonl);
    expect(result.result.message.role).toBe("assistant");
    expect(result.result.message.content).toBe("Hello World");
  });

  it("ignores blank lines, whitespace and still works", () => {
    const jsonl = `
    
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"content":"Line1 "}}
      
      {"created_at":"2023-01-02T09:00:00Z","done":true,"message":{"content":"Line2"}}
    
    `;

    const result = combineJsonl(jsonl);
    expect(result.lines).toHaveLength(2);
    expect(result.result.message.content).toBe("Line1 Line2");
  });

  it("throws on invalid JSON", () => {
    const jsonl = `
      {"created_at":"2023-01-01","done":false,"message":{"content":"Ok"}}
      { NOT VALID JSON }
      {"created_at":"2023-01-02","done":true,"message":{"content":"Done"}}
    `;

    expect(() => combineJsonl(jsonl)).toThrow("Invalid JSON");
  });

  it("throws for empty input or whitespace-only input", () => {
    expect(() => combineJsonl("")).toThrow("No JSON lines provided.");
    expect(() => combineJsonl("\n  \n")).toThrow("No JSON lines provided.");
  });

  it("throws LlmExeError with llm.invalid_jsonl_response on invalid JSON, preserving cause", () => {
    const jsonl = `
      {"created_at":"2023-01-01","done":false,"message":{"content":"Ok"}}
      { NOT VALID JSON }
      {"created_at":"2023-01-02","done":true,"message":{"content":"Done"}}
    `;
    try {
      combineJsonl(jsonl);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("llm.invalid_jsonl_response");
      expect((e as LlmExeError).category).toBe("llm");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("combineJsonl");
      expect(ctx.lineNumber).toBe(2);
      expect(String(ctx.lineExcerpt)).toContain("NOT VALID JSON");
      expect((e as unknown as { cause?: unknown }).cause).toBeDefined();
    }
  });

  it("throws LlmExeError with llm.invalid_jsonl_response on empty input", () => {
    try {
      combineJsonl("");
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("llm.invalid_jsonl_response");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("combineJsonl");
      expect(ctx.received).toBe(0);
    }
  });

  it("throws LlmExeError with llm.invalid_jsonl_response when no done line found", () => {
    const jsonl = `
      {"created_at":"2023-01-01","done":false,"message":{"content":"Ok"}}
      {"created_at":"2023-01-02","done":false,"message":{"content":"Still going"}}
    `;
    try {
      combineJsonl(jsonl);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("llm.invalid_jsonl_response");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("combineJsonl");
      expect(ctx.lineCount).toBe(2);
    }
  });

  it("uses first done line if multiple done=true lines", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":true,"model":"first-done","message":{"content":"First "}}
      {"created_at":"2023-01-02T10:00:00Z","done":true,"model":"second-done","message":{"content":"Second"}}
    `;
    const result = combineJsonl(jsonl);
    expect(result.result.model).toBe("first-done");
    expect(result.result.message.content).toBe("First Second");
  });

  it("handles missing message property with empty string", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":false}
      {"created_at":"2023-01-02T10:00:00Z","done":true,"model":"test-model"}
    `;
    const result = combineJsonl(jsonl);
    expect(result.content.text).toBe("");
  });

  it("handles message with null content", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"content":null}}
      {"created_at":"2023-01-02T10:00:00Z","done":true,"model":"test-model","message":{"content":null}}
    `;
    const result = combineJsonl(jsonl);
    expect(result.content.text).toBe("");
  });

  it("handles message with undefined content (missing property)", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"role":"assistant"}}
      {"created_at":"2023-01-02T10:00:00Z","done":true,"model":"test-model","message":{"role":"assistant"}}
    `;
    const result = combineJsonl(jsonl);
    expect(result.content.text).toBe("");
  });

  it("combines mixed null, undefined, and valid content", () => {
    const jsonl = `
      {"created_at":"2023-01-01T09:00:00Z","done":false,"message":{"content":"Hello "}}
      {"created_at":"2023-01-02T10:00:00Z","done":false,"message":{"content":null}}
      {"created_at":"2023-01-03T11:00:00Z","done":false,"message":{}}
      {"created_at":"2023-01-04T12:00:00Z","done":false}
      {"created_at":"2023-01-05T13:00:00Z","done":true,"message":{"content":"World"}}
    `;
    const result = combineJsonl(jsonl);
    expect(result.content.text).toBe("Hello World");
  });
});
