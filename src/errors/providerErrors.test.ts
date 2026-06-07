import {
  safeProviderErrorBody,
  safeResponseHeaders,
  parseRetryAfter,
  parseProviderErrorGeneric,
  statusToLlmProviderCode,
  statusToEmbeddingProviderCode,
  safeProviderString,
  truncateString,
  readStringField,
  readStringOrNumberField,
} from "./providerErrors";
import { serializeLlmExeError } from "./serialize";
import { LlmExeError } from "./LlmExeError";

const SYNTHETIC_SECRETS = [
  "sk-syntheticSecret1",
  "Bearer syntheticBearerToken",
  "syntheticPasswordValue",
  "syntheticCookieValue",
  "syntheticAwsSessionToken",
];

describe("safeProviderErrorBody", () => {
  it("redacts authorization, apiKey, openAiApiKey, awsSecretKey, token, password, cookie, set-cookie, x-amz-security-token", () => {
    const body = {
      authorization: "Bearer syntheticBearerToken",
      apiKey: "sk-syntheticSecret1",
      openAiApiKey: "sk-syntheticSecret1",
      awsSecretKey: "syntheticAwsSessionToken",
      token: "syntheticBearerToken",
      password: "syntheticPasswordValue",
      cookie: "syntheticCookieValue",
      "set-cookie": "syntheticCookieValue",
      "x-amz-security-token": "syntheticAwsSessionToken",
      safeField: "still here",
    };
    const out = safeProviderErrorBody(body) as Record<string, unknown>;
    for (const secret of SYNTHETIC_SECRETS) {
      expect(JSON.stringify(out)).not.toContain(secret);
    }
    expect(out.safeField).toBe("still here");
    expect(out.authorization).toBe("[redacted]");
    expect(out["set-cookie"]).toBe("[redacted]");
    expect(out["x-amz-security-token"]).toBe("[redacted]");
  });

  it("scrubs deeply nested secrets", () => {
    const body = {
      request: {
        headers: {
          Authorization: "Bearer syntheticBearerToken",
          "X-Amz-Security-Token": "syntheticAwsSessionToken",
        },
        nested: { credentials: { api_key: "sk-syntheticSecret1" } },
      },
    };
    const out = safeProviderErrorBody(body);
    const json = JSON.stringify(out);
    for (const secret of SYNTHETIC_SECRETS) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain("[redacted]");
  });

  it("truncates raw string bodies to maxBodyBytes", () => {
    const giant = "x".repeat(10000);
    const out = safeProviderErrorBody(giant) as string;
    expect(out.length).toBeLessThanOrEqual(8192 + 20);
    expect(out.endsWith("…(truncated)")).toBe(true);
  });

  it("truncates long strings inside an object", () => {
    const long = "y".repeat(5000);
    const out = safeProviderErrorBody({ msg: long }) as Record<string, string>;
    expect(out.msg.length).toBeLessThanOrEqual(2000 + 20);
  });

  it("respects custom maxBodyBytes and maxStringLength", () => {
    expect(
      (safeProviderErrorBody("hello world", { maxBodyBytes: 5 }) as string).startsWith(
        "hello"
      )
    ).toBe(true);
    const inObj = safeProviderErrorBody(
      { msg: "abcdefg" },
      { maxStringLength: 3 }
    ) as Record<string, string>;
    expect(inObj.msg.startsWith("abc")).toBe(true);
  });

  it("survives circular structures", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    expect(() => safeProviderErrorBody(obj)).not.toThrow();
    const out = safeProviderErrorBody(obj) as Record<string, unknown>;
    expect(JSON.stringify(out)).toContain("[Circular]");
  });

  it("passes through primitives", () => {
    expect(safeProviderErrorBody(42)).toBe(42);
    expect(safeProviderErrorBody(null)).toBe(null);
    expect(safeProviderErrorBody(undefined)).toBe(undefined);
    expect(safeProviderErrorBody(true)).toBe(true);
  });

  // Pattern-level scrubbing is exercised in redactSecrets.test.ts.
  // These two cases prove the wiring: safeProviderErrorBody runs redactSecrets
  // on both top-level raw strings and string values nested inside objects.

  it("scrubs secrets in raw string bodies (wired through redactSecrets)", () => {
    const out = safeProviderErrorBody(
      "Server returned 401\nAuthorization: Bearer sk-syntheticEchoedTokenAAAAAAAA"
    ) as string;
    expect(out).not.toContain("sk-syntheticEchoedTokenAAAAAAAA");
    expect(out).toContain("[redacted]");
  });

  it("scrubs secrets in string values nested inside objects", () => {
    const body = {
      requestPreview:
        "POST /v1\nAuthorization: Bearer sk-syntheticInsideObjectAAAAAAAAA",
      safeField: "still here",
    };
    const out = safeProviderErrorBody(body) as Record<string, string>;
    expect(out.requestPreview).not.toContain(
      "sk-syntheticInsideObjectAAAAAAAAA"
    );
    expect(out.safeField).toBe("still here");
  });
});

describe("safeResponseHeaders", () => {
  it("returns only allowlisted headers from a Headers instance", () => {
    const h = new Headers();
    h.set("Content-Type", "application/json");
    h.set("Authorization", "Bearer syntheticBearerToken");
    h.set("X-Request-Id", "abc");
    h.set("Retry-After", "5");
    h.set("X-Some-Internal-Header", "leaky");
    const out = safeResponseHeaders(h);
    expect(out["content-type"]).toBe("application/json");
    expect(out["x-request-id"]).toBe("abc");
    expect(out["retry-after"]).toBe("5");
    expect(out["authorization"]).toBeUndefined();
    expect(out["x-some-internal-header"]).toBeUndefined();
  });

  it("accepts a plain record", () => {
    const out = safeResponseHeaders({
      "Content-Type": "text/plain",
      "X-Goog-Request-Id": "g123",
      Authorization: "Bearer syntheticBearerToken",
    });
    expect(out["content-type"]).toBe("text/plain");
    expect(out["x-goog-request-id"]).toBe("g123");
    expect(out["authorization"]).toBeUndefined();
  });

  it("returns {} for empty inputs", () => {
    expect(safeResponseHeaders(undefined)).toEqual({});
    expect(safeResponseHeaders(null)).toEqual({});
    expect(safeResponseHeaders({})).toEqual({});
  });

  it("allowlists provider rate-limit headers", () => {
    const out = safeResponseHeaders({
      "X-Ratelimit-Remaining-Tokens": "100",
      "anthropic-ratelimit-tokens-remaining": "500",
    });
    expect(out["x-ratelimit-remaining-tokens"]).toBe("100");
    expect(out["anthropic-ratelimit-tokens-remaining"]).toBe("500");
  });
});

describe("parseRetryAfter", () => {
  it("parses integer seconds to milliseconds", () => {
    expect(parseRetryAfter("5")).toBe(5000);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("parses fractional seconds", () => {
    expect(parseRetryAfter("0.5")).toBe(500);
  });

  it("parses HTTP-date", () => {
    const fiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toUTCString();
    const ms = parseRetryAfter(fiveMinutes);
    expect(ms).toBeGreaterThan(4 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(5 * 60 * 1000 + 500);
  });

  it("clamps past HTTP-dates to 0", () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    expect(parseRetryAfter(past)).toBe(0);
  });

  it("returns undefined for invalid input", () => {
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter("")).toBeUndefined();
    expect(parseRetryAfter("not a date")).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe("parseProviderErrorGeneric", () => {
  it("normalizes an OpenAI-style body", () => {
    const result = parseProviderErrorGeneric({
      status: 429,
      statusText: "Too Many Requests",
      headers: { "retry-after": "10" },
      bodyJson: {
        error: {
          message: "Rate limit exceeded",
          type: "requests",
          code: "rate_limit_exceeded",
        },
      },
      provider: "openai",
    });
    expect(result.message).toBe("Rate limit exceeded");
    expect(result.providerType).toBe("requests");
    expect(result.providerCode).toBe("rate_limit_exceeded");
    expect(result.status).toBe(429);
    expect(result.statusText).toBe("Too Many Requests");
    expect(result.retryable).toBe(true);
    expect(result.retryAfterMs).toBe(10_000);
  });

  it("normalizes an Anthropic-style body", () => {
    const result = parseProviderErrorGeneric({
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      bodyJson: {
        type: "error",
        error: { type: "authentication_error", message: "Invalid API key" },
      },
      provider: "anthropic",
    });
    expect(result.message).toBe("Invalid API key");
    expect(result.providerType).toBe("authentication_error");
  });

  it("normalizes a Gemini-style body", () => {
    const result = parseProviderErrorGeneric({
      status: 400,
      statusText: "Bad Request",
      headers: {},
      bodyJson: {
        error: {
          code: "400",
          message: "Request contains an invalid argument.",
          status: "INVALID_ARGUMENT",
        },
      },
      provider: "google",
    });
    expect(result.message).toBe("Request contains an invalid argument.");
    expect(result.providerCode).toBe("400");
    expect(result.providerType).toBe("INVALID_ARGUMENT");
  });

  it("normalizes a Bedrock-style body", () => {
    const result = parseProviderErrorGeneric({
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      bodyJson: { message: "Service unavailable", __type: "InternalError" },
      provider: "bedrock",
    });
    expect(result.message).toBe("Service unavailable");
    expect(result.retryable).toBe(true);
  });

  it("falls back to body text when no JSON message is available", () => {
    const result = parseProviderErrorGeneric({
      status: 500,
      headers: {},
      bodyText: "plain text error",
      provider: "ollama",
    });
    expect(result.message).toBe("plain text error");
  });

  it("flags retryable for 408 and 5xx", () => {
    expect(
      parseProviderErrorGeneric({ status: 408, headers: {} }).retryable
    ).toBe(true);
    expect(
      parseProviderErrorGeneric({ status: 502, headers: {} }).retryable
    ).toBe(true);
    expect(
      parseProviderErrorGeneric({ status: 400, headers: {} }).retryable
    ).toBe(false);
  });

  it("treats string body.error as the message", () => {
    const result = parseProviderErrorGeneric({
      status: 400,
      headers: {},
      bodyJson: { error: "Bad input" },
    });
    expect(result.message).toBe("Bad input");
  });
});

describe("statusToLlmProviderCode", () => {
  it("maps 429 -> rate_limited", () => {
    expect(statusToLlmProviderCode(429)).toBe("llm.provider_rate_limited");
  });
  it("maps 401/403 -> auth_failed", () => {
    expect(statusToLlmProviderCode(401)).toBe("llm.provider_auth_failed");
    expect(statusToLlmProviderCode(403)).toBe("llm.provider_auth_failed");
  });
  it("maps 400/422 -> invalid_request", () => {
    expect(statusToLlmProviderCode(400)).toBe("llm.provider_invalid_request");
    expect(statusToLlmProviderCode(422)).toBe("llm.provider_invalid_request");
  });
  it("maps 408/5xx -> unavailable", () => {
    expect(statusToLlmProviderCode(408)).toBe("llm.provider_unavailable");
    expect(statusToLlmProviderCode(500)).toBe("llm.provider_unavailable");
    expect(statusToLlmProviderCode(503)).toBe("llm.provider_unavailable");
  });
  it("falls back to provider_http_error", () => {
    expect(statusToLlmProviderCode(418)).toBe("llm.provider_http_error");
  });
});

describe("statusToEmbeddingProviderCode", () => {
  it("maps the same way as the LLM code mapper", () => {
    expect(statusToEmbeddingProviderCode(429)).toBe(
      "embedding.provider_rate_limited"
    );
    expect(statusToEmbeddingProviderCode(401)).toBe(
      "embedding.provider_auth_failed"
    );
    expect(statusToEmbeddingProviderCode(400)).toBe(
      "embedding.provider_invalid_request"
    );
    expect(statusToEmbeddingProviderCode(503)).toBe(
      "embedding.provider_unavailable"
    );
    expect(statusToEmbeddingProviderCode(418)).toBe(
      "embedding.provider_http_error"
    );
  });
});

describe("secret-scrubbing fixtures end-to-end through serializeLlmExeError", () => {
  it("does not leak synthetic secrets when serializing an LlmExeError carrying provider data", () => {
    const scrubbedBody = safeProviderErrorBody({
      error: { message: "Rate limit exceeded" },
      requestHeaders: {
        authorization: "Bearer syntheticBearerToken",
        "x-amz-security-token": "syntheticAwsSessionToken",
      },
      apiKey: "sk-syntheticSecret1",
    });

    const headers = new Headers();
    headers.set("Authorization", "Bearer syntheticBearerToken");
    headers.set("X-Request-Id", "req-abc");
    headers.set("Retry-After", "5");

    const err = new LlmExeError("OpenAI request failed", {
      code: "llm.provider_rate_limited",
      context: {
        provider: "openai",
        model: "gpt-4o-mini",
        status: 429,
        statusText: "Too Many Requests",
        url: "https://api.openai.com/v1/chat/completions",
        providerErrorBody: scrubbedBody,
        responseHeaders: safeResponseHeaders(headers),
      },
      cause: new Error("network timeout"),
    });

    const json = JSON.stringify(serializeLlmExeError(err));
    for (const secret of SYNTHETIC_SECRETS) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain("req-abc");
    expect(json).toContain("[redacted]");
  });
});

describe("truncateString", () => {
  it("returns the input unchanged when at or below max", () => {
    expect(truncateString("hello", 5)).toBe("hello");
    expect(truncateString("hello", 10)).toBe("hello");
  });

  it("appends the truncation marker when over max", () => {
    expect(truncateString("hello world", 5)).toBe("hello…(truncated)");
  });

  it("handles empty strings", () => {
    expect(truncateString("", 5)).toBe("");
  });

  it("handles max of 0", () => {
    expect(truncateString("hello", 0)).toBe("…(truncated)");
  });
});

describe("safeProviderString", () => {
  it("returns undefined for non-strings and empty strings", () => {
    expect(safeProviderString(undefined)).toBeUndefined();
    expect(safeProviderString("")).toBeUndefined();
  });

  it("returns the input unchanged when short and clean", () => {
    expect(safeProviderString("hello")).toBe("hello");
  });

  it("scrubs secret-shaped tokens before returning", () => {
    const out = safeProviderString(
      "Got Authorization: Bearer sk-syntheticSafeProviderStringAAAA back"
    );
    expect(out).not.toContain("sk-syntheticSafeProviderStringAAAA");
  });

  it("truncates at the default max (240) with the truncation marker", () => {
    const long = "a".repeat(500);
    const out = safeProviderString(long);
    expect(out!.length).toBeLessThanOrEqual(240 + "…(truncated)".length);
    expect(out!.endsWith("…(truncated)")).toBe(true);
  });

  it("respects a custom max length", () => {
    expect(safeProviderString("hello world", 5)).toBe("hello…(truncated)");
  });

  it("does not append the marker when scrubbed length is exactly the max", () => {
    expect(safeProviderString("hello", 5)).toBe("hello");
  });
});

describe("readStringField", () => {
  it("returns the string when present", () => {
    expect(readStringField({ a: "x" }, "a")).toBe("x");
  });

  it("returns undefined when the field is not a string", () => {
    expect(readStringField({ a: 1 }, "a")).toBeUndefined();
    expect(readStringField({ a: true }, "a")).toBeUndefined();
    expect(readStringField({ a: null }, "a")).toBeUndefined();
    expect(readStringField({ a: {} }, "a")).toBeUndefined();
  });

  it("returns undefined when the field is missing", () => {
    expect(readStringField({}, "a")).toBeUndefined();
  });

  it("returns undefined for non-object inputs", () => {
    expect(readStringField(null, "a")).toBeUndefined();
    expect(readStringField(undefined, "a")).toBeUndefined();
    expect(readStringField("string", "a")).toBeUndefined();
    expect(readStringField(42, "a")).toBeUndefined();
  });
});

describe("readStringOrNumberField", () => {
  it("returns the string when present", () => {
    expect(readStringOrNumberField({ code: "BAD" }, "code")).toBe("BAD");
  });

  it("stringifies finite numbers", () => {
    expect(readStringOrNumberField({ code: 400 }, "code")).toBe("400");
    expect(readStringOrNumberField({ code: 0 }, "code")).toBe("0");
    expect(readStringOrNumberField({ code: -1 }, "code")).toBe("-1");
    expect(readStringOrNumberField({ code: 3.14 }, "code")).toBe("3.14");
  });

  it("returns undefined for non-finite numbers", () => {
    expect(readStringOrNumberField({ code: NaN }, "code")).toBeUndefined();
    expect(readStringOrNumberField({ code: Infinity }, "code")).toBeUndefined();
    expect(readStringOrNumberField({ code: -Infinity }, "code")).toBeUndefined();
  });

  it("returns undefined for other types", () => {
    expect(readStringOrNumberField({ code: true }, "code")).toBeUndefined();
    expect(readStringOrNumberField({ code: null }, "code")).toBeUndefined();
    expect(readStringOrNumberField({ code: {} }, "code")).toBeUndefined();
  });

  it("returns undefined for non-object inputs", () => {
    expect(readStringOrNumberField(null, "code")).toBeUndefined();
    expect(readStringOrNumberField("x", "code")).toBeUndefined();
  });
});

describe("safeProviderErrorBody scalar branches", () => {
  it("converts a bigint value to its decimal string", () => {
    const out = safeProviderErrorBody({ count: 123n }) as Record<string, unknown>;
    expect(out.count).toBe("123");
  });

  it("stringifies a symbol value", () => {
    const sym = Symbol("test");
    const out = safeProviderErrorBody({ marker: sym }) as Record<string, unknown>;
    expect(out.marker).toBe(String(sym));
  });

  it("replaces a function value with [Function]", () => {
    const out = safeProviderErrorBody({ fn: () => 1 }) as Record<string, unknown>;
    expect(out.fn).toBe("[Function]");
  });

  it("returns null and undefined values unchanged", () => {
    const out = safeProviderErrorBody({ a: null, b: undefined }) as Record<
      string,
      unknown
    >;
    expect(out.a).toBeNull();
    expect(out.b).toBeUndefined();
  });

  it("returns [deep] once the recursion depth limit is exceeded", () => {
    // MAX_SCRUB_DEPTH = 8. Build 9 wrapper objects so the 8th-level scrub
    // call hits the depth guard and yields the [deep] sentinel.
    let nested: any = "leaf";
    for (let i = 0; i < 9; i++) {
      nested = { nested };
    }
    const out = safeProviderErrorBody({ root: nested }) as Record<string, any>;
    let walker: any = out.root;
    // out.root traverses 7 .nested hops before the depth guard fires.
    for (let i = 0; i < 7; i++) {
      walker = walker.nested;
    }
    expect(walker).toBe("[deep]");
  });

  it("returns [Circular] when a cycle is detected during scrubbing", () => {
    const a: any = { name: "a" };
    a.self = a;
    const out = safeProviderErrorBody(a) as Record<string, unknown>;
    expect(out.self).toBe("[Circular]");
  });

  it("recurses through arrays", () => {
    const out = safeProviderErrorBody([
      { token: "syntheticBearerToken" },
      "plain",
    ]) as unknown[];
    expect(Array.isArray(out)).toBe(true);
    expect((out[0] as Record<string, unknown>).token).toBe("[redacted]");
    expect(out[1]).toBe("plain");
  });
});

describe("parseRetryAfter whitespace and Infinity branches", () => {
  it("returns undefined for whitespace-only input", () => {
    expect(parseRetryAfter("   \t\n  ")).toBeUndefined();
  });

  it("returns undefined when the numeric value overflows to Infinity", () => {
    // Regex matches \d+(\.\d+)? but Number() of a very large numeric string
    // returns Infinity, which must fall through to undefined.
    const huge = "1" + "0".repeat(400);
    expect(parseRetryAfter(huge)).toBeUndefined();
  });
});

describe("parseProviderErrorGeneric input shape fallbacks", () => {
  it("reads status/statusText from input.response when top-level fields are absent", () => {
    const out = parseProviderErrorGeneric({
      response: { status: 503, statusText: "Service Unavailable" },
    });
    expect(out.status).toBe(503);
    expect(out.statusText).toBe("Service Unavailable");
    expect(out.retryable).toBe(true);
  });

  it("treats absent headers as an empty record (no retry-after parsing)", () => {
    const out = parseProviderErrorGeneric({ status: 429 });
    expect(out.retryAfterMs).toBeUndefined();
    expect(out.retryable).toBe(true);
  });

  it("uses bodyJson.error directly when it is a string", () => {
    const out = parseProviderErrorGeneric({
      status: 500,
      bodyJson: { error: "Server exploded" },
    });
    expect(out.message).toBe("Server exploded");
  });

  it("leaves message undefined when bodyJson.error is a non-string primitive", () => {
    const out = parseProviderErrorGeneric({
      status: 500,
      bodyJson: { error: 42 },
    });
    expect(out.message).toBeUndefined();
  });
});
