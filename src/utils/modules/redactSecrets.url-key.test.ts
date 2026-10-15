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

  // KNOWN BUG — https://github.com/llm-exe/llm-exe/issues/857
  // `it.failing` keeps CI green while pinning the defect. Flip these to `it`
  // once redactSecrets covers a bare `key` label — `it.failing` fails once the
  // behavior is correct, so the fix cannot land without updating them.
  it.failing("redacts the Google-style key in a relative URL", () => {
    // Falls through to redactSecrets because `new URL()` throws.
    expect(safeRequestUrl("/v1/models:generateContent?key=AIzaSyFAKE123")).not.toContain(
      "AIzaSyFAKE123",
    );
  });

  it.failing("redacts a bare key= pair in free text (provider error bodies, logs)", () => {
    expect(redactSecrets("called with key=AIzaSyFAKE123")).not.toContain("AIzaSyFAKE123");
  });

  it("still redacts the labels it already covers", () => {
    expect(redactSecrets("api_key=abc123")).toBe("api_key=[redacted]");
    expect(redactSecrets("token=abc123")).toBe("token=[redacted]");
  });
});
