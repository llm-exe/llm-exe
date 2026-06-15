import { maskApiKeys, safeRequestUrl } from "./redactSecrets";

describe("maskApiKeys", () => {
  describe("JWT Bearer tokens", () => {
    it("should fully redact Bearer JWT tokens behind an Authorization label", () => {
      const log = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const masked = maskApiKeys(log);
      // Header label triggers full redaction (stricter than prefix/suffix masking).
      expect(masked).toBe("Authorization: [redacted]");
    });

    it("should mask Bearer JWT tokens that appear without a label", () => {
      const log = "Got Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U from upstream";
      const masked = maskApiKeys(log);
      expect(masked).toContain("Bear");
      expect(masked).toContain("sR8U");
      expect(masked).toContain("*");
    });

    it("should mask Bearer tokens with non-JWT format (20+ chars)", () => {
      const log = "Bearer abcdef1234567890abcdef1234567890";
      const masked = maskApiKeys(log);
      // The entire Bearer token is captured
      expect(masked).toBe("Bear*******************************7890");
    });

    it("should handle multiple JWT tokens in the same string", () => {
      const log = "Token1: Bearer abc.def.ghi Token2: Bearer jkl.mno.pqr";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Token1: Bear**********.ghi Token2: Bear**********.pqr");
    });
  });

  describe("OpenAI API keys", () => {
    it("should mask OpenAI secret keys", () => {
      const log = "Using API key: sk-1234567890abcdefghijklmnopqrstuvwxyz";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Using API key: sk-1*******************************wxyz");
    });

    it("should mask OpenAI keys with varying lengths", () => {
      const log = "Key: sk-proj-abcdef1234567890abcdef1234567890abcdef1234567890";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Key: sk-proj-abcd****************************************7890");
    });
  });

  describe("AWS access keys", () => {
    it("should mask AWS access key IDs", () => {
      const log = "AWS Access Key: AKIAIOSFODNN7EXAMPLE";
      const masked = maskApiKeys(log);
      expect(masked).toBe("AWS Access Key: AKIA************MPLE");
    });

    it("should only mask valid AWS key format (AKIA + 16 uppercase alphanumeric)", () => {
      const log = "Invalid: AKIAlowercase123456 Valid: AKIAIOSFODNN7EXAMPLE";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Invalid: AKIAlowercase123456 Valid: AKIA************MPLE");
    });
  });

  describe("generic long strings", () => {
    it("should mask 32+ character alphanumeric strings", () => {
      // Use a non-secret-label prefix so we exercise the bare token mask path,
      // not the header-label full-redaction path.
      const log = "Hash: abcdef1234567890abcdef1234567890";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Hash: abcd************************7890");
    });

    it("should mask very long alphanumeric strings", () => {
      const log = "Bytes: " + "a".repeat(100);
      const masked = maskApiKeys(log);
      const result = masked.split(": ")[1];
      expect(result.startsWith("aaaa")).toBe(true);
      expect(result.endsWith("aaaa")).toBe(true);
      expect(result).toMatch(/^aaaa\*+aaaa$/);
      expect(result.length).toBe(100);
    });
  });

  describe("edge cases", () => {
    it("should not mask tokens with 8 or fewer characters", () => {
      const log = "Short: sk-1234 Bearer abc12345";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Short: sk-1234 Bearer abc12345");
    });

    it("should handle empty strings", () => {
      expect(maskApiKeys("")).toBe("");
    });

    it("should handle strings with no sensitive data", () => {
      const log = "This is a normal log message with no secrets";
      const masked = maskApiKeys(log);
      expect(masked).toBe(log);
    });

    it("should preserve word boundaries", () => {
      const log = "prefixsk-1234567890abcdefghijsuffix";
      const masked = maskApiKeys(log);
      expect(masked).toBe("prefixsk-1234567890abcdefghijsuffix"); // Not masked due to word boundary
    });

    it("should mask multiple different types of keys", () => {
      const log = "Bearer token123456789012345678901234567890 sk-openaikey123456789012345 AKIAIOSFODNN7EXAMPLE";
      const masked = maskApiKeys(log);
      expect(masked).toContain("Bear**********************************7890");
      expect(masked).toContain("sk-o*******************2345");
      expect(masked).toContain("AKIA************MPLE");
    });

    it("should handle special characters in the middle of text", () => {
      const log = 'Key="sk-1234567890abcdefghij", Token=Bearer abc.def.ghi';
      const masked = maskApiKeys(log);
      // sk-... gets prefix/suffix masked; Token=... gets fully redacted by
      // the header/query label pattern.
      expect(masked).toBe('Key="sk-1***************ghij", Token=[redacted]');
    });

    it("should handle newlines and multiline logs", () => {
      const log = `Line 1: sk-1234567890abcdefghij
Line 2: Bearer token.with.three.parts
Line 3: AKIAIOSFODNN7EXAMPLE`;
      const masked = maskApiKeys(log);
      expect(masked).toContain("sk-1***************ghij");
      expect(masked).toContain("Bear***************hree.parts");
      expect(masked).toContain("AKIA************MPLE");
    });
  });

  describe("problematic patterns", () => {
    it("should unfortunately mask legitimate long alphanumeric strings", () => {
      // This test demonstrates the overly broad pattern issue
      const log = "SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const masked = maskApiKeys(log);
      // This shows the function masks SHA hashes, which is not ideal
      expect(masked).toBe("SHA256: e3b0********************************************************b855");
    });

    it("should unfortunately mask base64 encoded content", () => {
      // This test demonstrates another false positive
      const log = "Encoded: YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw";
      const masked = maskApiKeys(log);
      // Base64 strings often exceed 32 chars and get masked
      expect(masked).toBe("Encoded: YWJj****************************************ODkw");
    });

    it("should not mask strings with special characters breaking the alphanumeric pattern", () => {
      const log = "ID: abc-def-ghi-jkl-mno-pqr-stu-vwx-yz0-123-456-789";
      const masked = maskApiKeys(log);
      // Hyphens break the pattern, so this won't be masked
      expect(masked).toBe(log);
    });
  });

  describe("short match guard (line 13 branch)", () => {
    it("should not produce matches <= 8 characters with current regex patterns", () => {
      // The regex requires: Bearer + 20+ chars, sk- + 20+ chars,
      // AKIA + 16 chars, or 32+ alphanumeric chars.
      // All patterns produce matches > 8 chars, making the <= 8 guard
      // effectively unreachable dead code. This test documents that behavior.
      const shortInputs = [
        "sk-abc",
        "AKIA1234",
        "Bearer x",
        "abcd1234",
        "short",
      ];
      for (const input of shortInputs) {
        // None of these should be masked (they don't match the regex at all)
        expect(maskApiKeys(input)).toBe(input);
      }
    });
  });

  describe("real-world scenarios", () => {
    it("should fully redact API keys behind known JSON labels", () => {
      const log = JSON.stringify({
        headers: {
          Authorization: "Bearer sk-1234567890abcdefghijklmnop"
        },
        aws_key: "AKIAIOSFODNN7EXAMPLE"
      }, null, 2);
      const masked = maskApiKeys(log);
      // JSON-shaped fields with known secret labels are fully redacted.
      expect(masked).toContain('"Authorization": "[redacted]"');
      // Keys outside the label allowlist still benefit from token masking.
      expect(masked).toContain('"aws_key": "AKIA************MPLE"');
    });

    it("should fully redact tokens behind a query-string label", () => {
      const log = "https://api.example.com?token=sk-1234567890abcdefghijklmnop&other=value";
      const masked = maskApiKeys(log);
      expect(masked).toBe("https://api.example.com?token=[redacted]&other=value");
    });

    it("should mask tokens in error messages", () => {
      const log = "Error: Invalid token Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature at line 42";
      const masked = maskApiKeys(log);
      expect(masked).toBe("Error: Invalid token Bear*****************************************************ture at line 42");
    });
  });

  describe("header- and query-style labels", () => {
    it("fully redacts Authorization headers", () => {
      const out = maskApiKeys(
        "Server returned 401\nAuthorization: Bearer sk-syntheticEchoedTokenAAAAAAAA"
      );
      expect(out).not.toContain("sk-syntheticEchoedTokenAAAAAAAA");
      expect(out).toContain("Authorization: [redacted]");
    });

    it("fully redacts Cookie and Set-Cookie headers", () => {
      const out = maskApiKeys("Cookie: session=syntheticCookieValueXYZ; Path=/");
      expect(out).not.toContain("syntheticCookieValueXYZ");
      expect(out).toContain("Cookie: [redacted]");
    });

    it("fully redacts x-amz-security-token in query strings", () => {
      const out = maskApiKeys(
        "GET /v1/x?x-amz-security-token=syntheticAwsQueryToken&safe=ok"
      );
      expect(out).not.toContain("syntheticAwsQueryToken");
      expect(out).toContain("safe=ok");
    });
  });

  describe("alternate auth schemes", () => {
    it("fully redacts Basic credentials", () => {
      const out = maskApiKeys("Basic c3ludGhldGljOnNlY3JldHBhc3N3b3Jk");
      expect(out).not.toContain("c3ludGhldGljOnNlY3JldHBhc3N3b3Jk");
      expect(out).toContain("Basic [redacted]");
    });

    it("fully redacts Digest credentials", () => {
      const out = maskApiKeys("Digest syntheticDigestCredentialXYZ");
      expect(out).not.toContain("syntheticDigestCredentialXYZ");
      expect(out).toContain("Digest [redacted]");
    });

    it("fully redacts AWS Sig v4 prefixes", () => {
      const out = maskApiKeys(
        "AWS4-HMAC-SHA256 Credential=AKIASYNTHETICKEYAAAA/20240101/us-east-1/s3/aws4_request"
      );
      expect(out).not.toContain("AKIASYNTHETICKEYAAAA");
    });
  });

  describe("provider-specific key shapes not caught by the legacy regex", () => {
    it("masks Anthropic sk-ant-* keys (dashes break the OpenAI sk- pattern)", () => {
      const out = maskApiKeys(
        "Key sk-ant-syntheticAnthropicTokenAAAA was rejected"
      );
      expect(out).not.toContain("sk-ant-syntheticAnthropicTokenAAAA");
    });

    it("masks Google AIza* keys", () => {
      const out = maskApiKeys(
        "AIzaSyntheticGoogleApiKeyAAAAAAAAAAAAAA rejected"
      );
      expect(out).not.toContain("AIzaSyntheticGoogleApiKeyAAAAAAAAAAAAAA");
    });
  });
});

describe("safeRequestUrl", () => {
  it("redacts Google-style ?key= query param", () => {
    const out = safeRequestUrl(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyntheticGoogleApiKeyAAAAAAAAAAAAAA"
    );
    expect(out).not.toContain("AIzaSyntheticGoogleApiKeyAAAAAAAAAAAAAA");
    expect(out).toContain("generativelanguage.googleapis.com");
    expect(out).toContain("gemini-pro:generateContent");
  });

  it("redacts common secret-bearing query keys (case-insensitive)", () => {
    const out = safeRequestUrl(
      "https://api.example.com/x?API_KEY=syntheticApiKeyValueXXX&Token=syntheticTokenValueXXX&safe=ok"
    );
    expect(out).not.toContain("syntheticApiKeyValueXXX");
    expect(out).not.toContain("syntheticTokenValueXXX");
    expect(out).toContain("safe=ok");
  });

  it("redacts AWS Sig v4 query auth parameters", () => {
    const out = safeRequestUrl(
      "https://bucket.s3.amazonaws.com/object?X-Amz-Signature=syntheticAwsSignatureXXX&X-Amz-Security-Token=syntheticAwsTokenXXX"
    );
    expect(out).not.toContain("syntheticAwsSignatureXXX");
    expect(out).not.toContain("syntheticAwsTokenXXX");
  });

  it("redacts OAuth-style access_token and refresh_token", () => {
    const out = safeRequestUrl(
      "https://api.example.com/x?access_token=syntheticOauthTokenXXX&refresh_token=syntheticRefreshXXX"
    );
    expect(out).not.toContain("syntheticOauthTokenXXX");
    expect(out).not.toContain("syntheticRefreshXXX");
  });

  it("leaves non-secret query parameters alone", () => {
    const out = safeRequestUrl(
      "https://api.example.com/x?model=gpt-4&page=2"
    );
    expect(out).toContain("model=gpt-4");
    expect(out).toContain("page=2");
  });

  it("runs redactSecrets on the path when URL parse succeeds", () => {
    // Even after URL parsing, a secret embedded in the path should still be
    // caught by the second-pass redactSecrets call.
    const out = safeRequestUrl(
      "https://api.example.com/sk-syntheticPathTokenAAAAAAAA/info"
    );
    expect(out).not.toContain("sk-syntheticPathTokenAAAAAAAA");
  });

  it("falls back to redactSecrets when URL parsing fails", () => {
    const out = safeRequestUrl(
      "not-a-url Bearer sk-syntheticFallbackTokenAAAAAAAA"
    );
    expect(out).not.toContain("sk-syntheticFallbackTokenAAAAAAAA");
  });

  it("returns empty/undefined inputs as-is", () => {
    expect(safeRequestUrl("")).toBe("");
    expect(safeRequestUrl(undefined as unknown as string)).toBe(undefined);
  });
});