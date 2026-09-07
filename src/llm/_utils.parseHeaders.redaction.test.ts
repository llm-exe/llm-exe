import { parseHeaders } from "@/llm/_utils.parseHeaders";
import { LlmExeError } from "@/errors";
import { Config } from "@/types";

/**
 * When a headers template fails to parse, the error message and context embed
 * the *post-replacement* string — which by definition contains real credentials
 * (Authorization, x-api-key, AWS keys). These tests exercise the real
 * replacement + redaction path (no mocks) to pin that no live secret escapes
 * into an error that will land in logs or an error reporter.
 */
describe("parseHeaders — secret redaction in header parse failures", () => {
  const makeConfig = (headers: string): Config =>
    ({
      provider: "openai.chat.v1",
      key: "openai",
      method: "POST",
      headers,
    }) as unknown as Config;

  const payload = { url: "https://api.example.com/v1", headers: {}, body: "{}" };

  const parseExpectingFailure = async (
    headers: string,
    replacements: Record<string, any>
  ): Promise<LlmExeError> => {
    try {
      await parseHeaders(makeConfig(headers), replacements, payload);
    } catch (error) {
      return error as LlmExeError;
    }
    throw new Error("expected parseHeaders to throw");
  };

  it("does not leak an OpenAI key into the error message or context", async () => {
    const secret = "sk-syntheticAAAAAAAAAAAAAAAAAAAAAAAA";
    // Missing closing brace -> JSON.parse fails after replacement.
    const error = await parseExpectingFailure(
      `{"Authorization": "Bearer {{apiKey}}"`,
      { apiKey: secret }
    );

    expect(error).toBeInstanceOf(LlmExeError);
    expect(error.code).toBe("configuration.invalid_headers");

    const serialized = JSON.stringify({
      message: error.message,
      context: error.context,
    });
    expect(serialized).not.toContain(secret);
  });

  it("does not leak an AWS secret access key", async () => {
    const secret = "AKIAIOSFODNN7EXAMPLE";
    const error = await parseExpectingFailure(`{"x-api-key": "{{apiKey}}"`, {
      apiKey: secret,
    });
    expect(JSON.stringify(error.context)).not.toContain(secret);
    expect(error.message).not.toContain(secret);
  });

  it("keeps the unreplaced template in context so the config is still debuggable", async () => {
    const template = `{"x-api-key": "{{apiKey}}"`;
    const error = await parseExpectingFailure(template, {
      apiKey: "sk-syntheticBBBBBBBBBBBBBBBBBBBBBBBB",
    });
    const context = error.context as Record<string, any>;
    expect(context.operation).toBe("parseHeaders");
    expect(context.headerTemplate).toBe(template);
    expect(context.resolution).toEqual(expect.any(String));
  });

  it("truncates a very long replaced-headers excerpt", async () => {
    const long = "a".repeat(5000);
    const error = await parseExpectingFailure(`{"x-api-key": "{{apiKey}}"`, {
      apiKey: long,
    });
    const excerpt = (error.context as Record<string, any>)
      .replacedHeadersExcerpt as string;
    expect(excerpt).toContain("…(truncated)");
    // 500-char cap plus the truncation marker — nowhere near the 5000-char input.
    expect(excerpt.length).toBeLessThan(700);
  });

  it("rejects a headers template that parses to a JSON array", async () => {
    const error = await parseExpectingFailure(`["not", "an", "object"]`, {});
    expect(error.message).toContain("Headers must be a JSON object");
  });

  it("rejects a headers template that parses to JSON null", async () => {
    const error = await parseExpectingFailure(`null`, {});
    expect(error.message).toContain("Headers must be a JSON object");
  });

  it("rejects a headers template that parses to a JSON scalar", async () => {
    const error = await parseExpectingFailure(`42`, {});
    expect(error.message).toContain("Headers must be a JSON object");
  });

  it("preserves the underlying parse error as the cause", async () => {
    const error = await parseExpectingFailure(`{"broken"`, {});
    // `cause` is accepted by the LlmExeError constructor and set at runtime,
    // but is not surfaced on the public type — hence the cast.
    expect((error as unknown as { cause?: unknown }).cause).toBeInstanceOf(Error);
  });

  describe("success path", () => {
    it("merges parsed headers over the payload headers", async () => {
      const result = await parseHeaders(
        makeConfig(`{"x-api-key": "{{apiKey}}"}`),
        { apiKey: "abc123" },
        { ...payload, headers: { "content-type": "application/json" } }
      );
      expect(result).toEqual({
        "content-type": "application/json",
        "x-api-key": "abc123",
      });
    });

    it("returns the payload headers untouched when the template is empty", async () => {
      const result = await parseHeaders(makeConfig(""), {}, {
        ...payload,
        headers: { "content-type": "application/json" },
      });
      expect(result).toEqual({ "content-type": "application/json" });
    });
  });
});
