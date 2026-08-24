import { apiRequest } from "@/utils/modules/request";
import { LlmExeError } from "@/errors";

const fetchMock = jest.fn();

jest.mock('node:fetch', () => ({
  __esModule: true,
  default: fetchMock
}));

const originalFetch = global.fetch;
Object.defineProperty(global, 'fetch', {
  configurable: true,
  get: () => fetchMock
});

afterAll(() => {
  Object.defineProperty(global, "fetch", {
    configurable: true,
    get: () => originalFetch,
  });
});

describe("apiRequest", () => {
  const url = "https://api.example.com/data";
  const dummyData = { key: "value" };

  const jsonMock = jest.fn();
  const textMock = jest.fn();
  const globalFetch = fetchMock as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock.mockResolvedValue(dummyData);
    textMock.mockResolvedValue("Some error message");
  });
  it("should make error early without a url", async () => {
    await expect(apiRequest("")).rejects.toThrow(`Invalid URL`);
  });
  it("should make error early without a valid url", async () => {
    await expect(apiRequest("not-a-url")).rejects.toThrow(`Invalid URL`);
  });
  it("should make a request and return the data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    const { data } = await apiRequest<typeof dummyData>(url);
    expect(data).toEqual(dummyData);
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("returns response headers alongside the data, with lowercased keys", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      headers: new Headers({
        "content-type": "application/json",
        "X-Amzn-Bedrock-Input-Token-Count": "5",
      }),
    } as unknown as Response);

    const { data, headers } = await apiRequest<typeof dummyData>(url);
    expect(data).toEqual(dummyData);
    expect(headers).toEqual(
      expect.objectContaining({ "x-amzn-bedrock-input-token-count": "5" })
    );
  });

  it("should make a request and return the data as text according to headers ", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      text: textMock,
      headers: new Headers({
        "content-type": "application/x-ndjson", // not json
      }),
    } as unknown as Response);
    const mockJsonl = JSON.stringify({ testing: "jsonl" });
    textMock.mockResolvedValue(mockJsonl);
    const { data } = await apiRequest<typeof dummyData>(url);
    expect(data).toEqual(mockJsonl);
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("should handle HTTP errors correctly", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: textMock,
      json: jest.fn(),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 404. Error Message: Some error message`
    );
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("falls back to default message when response body is empty", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: jest.fn().mockResolvedValue(""),
      json: jest.fn(),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status: 500. Error Message: Internal Server Error`
    );
  });

  it("falls back to raw text when response body is not JSON", async () => {
    const rawText = "plain text error from upstream";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue(rawText),
      json: jest.fn(),
      headers: new Headers({
        "content-type": "text/plain",
      }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 502. Error Message: ${rawText}`
    );
  });

  it("should throw a generic error if the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("Fetch failed"));

    await expect(apiRequest(url)).rejects.toThrow(
      "Request to https://api.example.com/data failed: Fetch failed"
    );
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });


  it("extracts the error.message field from a JSON error body", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({ error: { message: "No further details provided." } })
        ),
      json: jest.fn(),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    const oaiUrl = `https://api.openai.com/something`;

    await expect(apiRequest(oaiUrl)).rejects.toThrow(
      `Request to ${oaiUrl} failed: HTTP error. Status Code: 404. Error Message: No further details provided.`
    );
  });
  

  it("extracts the error string from body.error when it is a string", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ error: "Forbidden by policy" })),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 403. Error Message: Forbidden by policy`
    );
  });

  it("extracts body.message when body.error is absent", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ message: "Validation failed" })),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 422. Error Message: Validation failed`
    );
  });

  it("JSON-stringifies detail when it resolves to a non-string value", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({ error: { code: "BAD_REQUEST", details: [1, 2] } })
        ),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 400. Error Message: {"code":"BAD_REQUEST","details":[1,2]}`
    );
  });

  it("falls back to raw text when JSON body has no error or message fields", async () => {
    const rawJson = JSON.stringify({ code: 123, info: "unexpected shape" });
    globalFetch.mockResolvedValue({
      ok: false,
      status: 418,
      text: jest.fn().mockResolvedValue(rawJson),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 418. Error Message: ${rawJson}`
    );
  });

  it("falls back to default message when text() itself throws", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: jest.fn().mockRejectedValue(new Error("stream consumed")),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status: 503. Error Message: Service Unavailable`
    );
  });

  it("falls back to 'Unknown error.' when statusText is empty", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "",
      text: jest.fn().mockRejectedValue(new Error("unreadable")),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status: 500. Error Message: Unknown error.`
    );
  });

  it("should handle null responses correctly", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(null),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    const { data } = await apiRequest<null>(url);
    expect(data).toBe(null);
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("should accept and merge custom request options", async () => {
    const customOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    await apiRequest(url, customOptions);
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

  describe("v3 LlmExeError contract", () => {
    it("throws LlmExeError with request.invalid_url on bad URL", async () => {
      try {
        await apiRequest("not-a-url");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("request.invalid_url");
        expect((e as LlmExeError).category).toBe("request");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("apiRequest");
        expect(ctx.url).toBe("not-a-url");
        expect(ctx.expected).toBe("valid URL");
      }
    });

    it("throws LlmExeError with request.http_error on fetch rejection, preserving cause", async () => {
      const fetchErr = new Error("Fetch failed");
      fetchMock.mockRejectedValue(fetchErr);
      try {
        await apiRequest(url);
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("request.http_error");
        expect((e as LlmExeError).category).toBe("request");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("apiRequest");
        expect(ctx.url).toBe(url);
        expect((e as unknown as { cause?: unknown }).cause).toBe(fetchErr);
      }
    });

    it("throws LlmExeError with request.http_error on non-OK with full structured context", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: jest
          .fn()
          .mockResolvedValue(
            JSON.stringify({
              error: { message: "Rate limit exceeded", type: "requests", code: "rate_limit_exceeded" },
            })
          ),
        json: jest.fn(),
        headers: new Headers({
          "content-type": "application/json",
          "retry-after": "10",
          "x-request-id": "req-abc",
        }),
      } as unknown as Response);

      try {
        await apiRequest(url);
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("request.http_error");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.url).toBe(url);
        expect(ctx.status).toBe(429);
        expect(ctx.statusText).toBe("Too Many Requests");
        const headers = ctx.responseHeaders as Record<string, string>;
        expect(headers["x-request-id"]).toBe("req-abc");
        expect(headers["retry-after"]).toBe("10");
        const pe = ctx.providerError as Record<string, unknown>;
        expect(pe.message).toBe("Rate limit exceeded");
        expect(pe.providerType).toBe("requests");
        expect(pe.providerCode).toBe("rate_limit_exceeded");
        expect(pe.retryable).toBe(true);
        expect(pe.retryAfterMs).toBe(10_000);
      }
    });
  });

  describe("provider body shape acceptance", () => {
    function setupResponse(status: number, body: unknown, statusText = "") {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        statusText,
        text: jest
          .fn()
          .mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
        json: jest.fn(),
        headers: new Headers({ "content-type": "application/json" }),
      } as unknown as Response);
    }

    it("normalizes OpenAI-style { error: { message, type, code } }", async () => {
      setupResponse(429, {
        error: { message: "Rate limit", type: "requests", code: "rl_exceeded" },
      });
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.message).toBe("Rate limit");
        expect(pe.providerType).toBe("requests");
        expect(pe.providerCode).toBe("rl_exceeded");
      }
    });

    it("normalizes Anthropic-style { type: 'error', error: { type, message } }", async () => {
      setupResponse(401, {
        type: "error",
        error: { type: "authentication_error", message: "Invalid API key" },
      });
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.message).toBe("Invalid API key");
        expect(pe.providerType).toBe("authentication_error");
      }
    });

    it("normalizes Gemini-style { error: { code, message, status } }", async () => {
      setupResponse(400, {
        error: {
          code: "400",
          message: "Request contains an invalid argument.",
          status: "INVALID_ARGUMENT",
        },
      });
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.message).toBe("Request contains an invalid argument.");
        expect(pe.providerCode).toBe("400");
        expect(pe.providerType).toBe("INVALID_ARGUMENT");
      }
    });

    it("normalizes AWS/Bedrock-style { message, __type }", async () => {
      setupResponse(500, { message: "Service unavailable", __type: "InternalError" });
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.message).toBe("Service unavailable");
        expect(pe.retryable).toBe(true);
      }
    });

    it("normalizes plain text body", async () => {
      setupResponse(500, "Upstream is down");
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.message).toBe("Upstream is down");
      }
    });
  });

  describe("retry-after parsing", () => {
    function setupRetryAfter(value: string) {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: { message: "slow down" } })),
        json: jest.fn(),
        headers: new Headers({
          "content-type": "application/json",
          "retry-after": value,
        }),
      } as unknown as Response);
    }

    it("parses integer seconds into milliseconds", async () => {
      setupRetryAfter("5");
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.retryAfterMs).toBe(5_000);
      }
    });

    it("parses HTTP-date into millisecond delta", async () => {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60_000).toUTCString();
      setupRetryAfter(fiveMinutesFromNow);
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.retryAfterMs as number).toBeGreaterThan(4 * 60_000);
        expect(pe.retryAfterMs as number).toBeLessThanOrEqual(5 * 60_000 + 500);
      }
    });
  });

  describe("secret redaction", () => {
    it("scrubs secrets from providerErrorRaw, providerErrorBody, and responseHeaders", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: jest
          .fn()
          .mockResolvedValue(
            JSON.stringify({
              error: { message: "boom" },
              authorization: "Bearer sk-syntheticBodyTokenAAAAAAAA",
              requestPreview: "POST /v1\nAuthorization: Bearer sk-syntheticPreviewTokenAAAAAAAA",
            })
          ),
        json: jest.fn(),
        headers: new Headers({
          "content-type": "application/json",
          // Allowlisted headers only; Authorization would be dropped entirely by safeResponseHeaders.
          "x-request-id": "req-xyz",
          "retry-after": "1",
        }),
      } as unknown as Response);

      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        const json = JSON.stringify(ctx);
        expect(json).not.toContain("sk-syntheticBodyTokenAAAAAAAA");
        expect(json).not.toContain("sk-syntheticPreviewTokenAAAAAAAA");
        // The allowlist should keep diagnostic headers but exclude unsafe ones.
        const headers = ctx.responseHeaders as Record<string, string>;
        expect(headers["x-request-id"]).toBe("req-xyz");
        expect(headers["authorization"]).toBeUndefined();
      }
    });

    it("scrubs secrets out of error.message itself when a provider echoes auth in its message field", async () => {
      // Real-world hazard: providers occasionally include the offending
      // Authorization header in error.message ("Invalid token: Bearer ...").
      // That value flows into the legacy message string and would otherwise
      // land in Sentry titles unredacted.
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              message:
                "Invalid credentials. Authorization: Bearer sk-syntheticEchoedInMessageAAAA was rejected.",
            },
          })
        ),
        json: jest.fn(),
        headers: new Headers({ "content-type": "application/json" }),
      } as unknown as Response);

      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const err = e as LlmExeError;
        expect(err.message).not.toContain(
          "sk-syntheticEchoedInMessageAAAA"
        );
        // And the normalized providerError.message must be scrubbed too,
        // since wrappers (llm.call / embedding.call) pass it through to the
        // new error's message.
        const pe = err.context!.providerError as Record<string, unknown>;
        expect(String(pe.message)).not.toContain(
          "sk-syntheticEchoedInMessageAAAA"
        );
      }
    });

    it("scrubs secrets out of the URL itself (Google-style ?key= leak)", async () => {
      // Google Gemini puts the API key in the URL query string. That URL flows
      // into both error.message ("Request to <url> failed: ...") and context.url.
      // Without safeRequestUrl, the key would land in Sentry titles unredacted.
      const leakyUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyntheticGeminiKeyAAAAAAAAAAAAAA";
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: jest
          .fn()
          .mockResolvedValue(JSON.stringify({ error: { message: "Invalid key" } })),
        json: jest.fn(),
        headers: new Headers({ "content-type": "application/json" }),
      } as unknown as Response);

      try {
        await apiRequest(leakyUrl);
        throw new Error("expected throw");
      } catch (e) {
        const err = e as LlmExeError;
        expect(err.message).not.toContain("AIzaSyntheticGeminiKeyAAAAAAAAAAAAAA");
        const ctx = err.context as Record<string, unknown>;
        expect(String(ctx.url)).not.toContain("AIzaSyntheticGeminiKeyAAAAAAAAAAAAAA");
        // Sanity-check the rest of the URL survived.
        expect(String(ctx.url)).toContain("generativelanguage.googleapis.com");
      }
    });

    it("scrubs secrets out of the URL on fetch rejection too", async () => {
      const leakyUrl =
        "https://example.com/x?api_key=syntheticFetchRejectKeyAAAAAAAA";
      fetchMock.mockRejectedValue(new Error("network down"));
      try {
        await apiRequest(leakyUrl);
        throw new Error("expected throw");
      } catch (e) {
        const err = e as LlmExeError;
        expect(err.message).not.toContain("syntheticFetchRejectKeyAAAAAAAA");
        expect(String((err.context as Record<string, unknown>).url)).not.toContain(
          "syntheticFetchRejectKeyAAAAAAAA"
        );
      }
    });

    it("scrubs secrets out of plain-text body bodies that get used as the message", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: jest
          .fn()
          .mockResolvedValue(
            "Upstream rejected request with Authorization: Bearer sk-syntheticTextBodyTokenAAAA"
          ),
        json: jest.fn(),
        headers: new Headers({ "content-type": "text/plain" }),
      } as unknown as Response);

      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        expect((e as LlmExeError).message).not.toContain(
          "sk-syntheticTextBodyTokenAAAA"
        );
      }
    });
  });

  describe("normalization edge cases", () => {
    function setupResponse(status: number, body: unknown) {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        statusText: "",
        text: jest
          .fn()
          .mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
        json: jest.fn(),
        headers: new Headers({ "content-type": "application/json" }),
      } as unknown as Response);
    }

    it("captures Bedrock __type as providerType", async () => {
      setupResponse(500, {
        message: "Service unavailable",
        __type: "InternalServerException",
      });
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.providerType).toBe("InternalServerException");
      }
    });

    it("captures Gemini-style numeric error.code as a stringified providerCode", async () => {
      setupResponse(400, {
        error: {
          code: 400,
          message: "Bad arg",
          status: "INVALID_ARGUMENT",
        },
      });
      try {
        await apiRequest(url);
        throw new Error("expected throw");
      } catch (e) {
        const pe = (e as LlmExeError).context!.providerError as Record<string, unknown>;
        expect(pe.providerCode).toBe("400");
      }
    });
  });

  describe("error message fallbacks when the body is empty", () => {
    function setupEmptyBodyResponse(status: number, statusText: string) {
      fetchMock.mockResolvedValue({
        ok: false,
        status,
        statusText,
        text: jest.fn().mockResolvedValue(""),
        json: jest.fn(),
        headers: new Headers({ "content-type": "application/json" }),
      } as unknown as Response);
    }

    it("falls back to statusText when the response body is empty", async () => {
      setupEmptyBodyResponse(502, "Bad Gateway");

      await expect(apiRequest(url)).rejects.toThrow(
        "HTTP error. Status: 502. Error Message: Bad Gateway"
      );
    });

    it("falls back to 'Unknown error.' when body and statusText are both empty", async () => {
      // HTTP/2 responses carry no reason phrase, so statusText is "".
      setupEmptyBodyResponse(500, "");

      await expect(apiRequest(url)).rejects.toThrow(
        "HTTP error. Status: 500. Error Message: Unknown error."
      );
    });
  });

});