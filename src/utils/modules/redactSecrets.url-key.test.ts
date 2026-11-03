import { redactSecrets, safeRequestUrl } from "./redactSecrets";

/**
 * Google Gemini authenticates with `?key=<API key>`. `safeRequestUrl` lists
 * "key" in SECRET_URL_QUERY_KEYS, but that set is only consulted when
 * `new URL(url)` succeeds. When URL parsing throws (relative URL), the
 * function falls through to `redactSecrets`, whose header/query pattern
 * covers `api_key`/`apikey`/`token`/`secret` but NOT a bare `key`.
 */
describe("bare ?key= query parameter", () => {
  it("redacts the Google-style key in an absolute URL", () => {
    expect(safeRequestUrl("https://g.co/v1/m:gen?key=AIzaSyFAKE123&alt=sse")).not.toContain(
      "AIzaSyFAKE123",
    );
  });

  // Regression for https://github.com/llm-exe/llm-exe/issues/857
  it("redacts the Google-style key in a relative URL", () => {
    // Falls through to redactSecrets because `new URL()` throws.
    expect(safeRequestUrl("/v1/models:generateContent?key=AIzaSyFAKE123")).not.toContain(
      "AIzaSyFAKE123",
    );
  });

  it("redacts a bare key= pair in free text (provider error bodies, logs)", () => {
    expect(redactSecrets("called with key=AIzaSyFAKE123")).not.toContain("AIzaSyFAKE123");
  });

  it("redacts the bare key in a relative URL without touching other params", () => {
    expect(safeRequestUrl("/v1/m:gen?alt=sse&key=AIzaSyFAKE123&x=1")).toBe(
      "/v1/m:gen?alt=sse&key=[redacted]&x=1",
    );
  });

  it("leaves prose `key:` labels to the token mask", () => {
    expect(redactSecrets("API key: sk-1234567890abcdefghijklmnop")).toBe(
      "API key: sk-1*********************mnop",
    );
  });

  // `"key"` is a common non-secret JSON field (map/state keys in debug
  // logs), so JSON-shaped `key` fields are deliberately not redacted.
  it("leaves a JSON-shaped key field alone", () => {
    expect(redactSecrets('{"key":"val"}')).toBe('{"key":"val"}');
  });

  it("does not swallow labels that merely end in or start with key", () => {
    expect(redactSecrets("monkey=banana")).toBe("monkey=banana");
    expect(redactSecrets("hotkey: ctrl+s")).toBe("hotkey: ctrl+s");
    expect(redactSecrets("keyboard=qwerty")).toBe("keyboard=qwerty");
    expect(redactSecrets('{"monkey":"banana"}')).toBe('{"monkey":"banana"}');
  });

  it("still redacts the labels it already covers", () => {
    expect(redactSecrets("api_key=abc123")).toBe("api_key=[redacted]");
    expect(redactSecrets("token=abc123")).toBe("token=[redacted]");
  });
});
