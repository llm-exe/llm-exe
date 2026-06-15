// Patterns for token-shaped secrets that benefit from prefix/suffix masking
// (preserves recognizability for debug logs without leaking the full value).
const TOKEN_MASK_REGEX =
  /\b(Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[A-Z0-9]{16}|[A-Za-z0-9]{32,})\b/g;

// Patterns for shapes whose value is opaque from context (header/JSON labels,
// alternate auth schemes, query-string secrets). Full redaction is cleaner
// than partial masking for these.
const FULL_REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Alternate auth schemes.
  [/\b(Basic|Digest|AWS4-HMAC-SHA256)\s+[A-Za-z0-9+/=._-]+/g, "$1 [redacted]"],
  // Header- or query-style key/value pairs. Preserves the original separator
  // ("Authorization: ..." stays colon, "?token=..." stays equals).
  [
    /(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-amz-security-token|x-amz-signature|api[-_]?key|access[-_]?token|token|secret|password)(\s*[:=]\s*)[^\r\n,;&]+/gi,
    "$1$2[redacted]",
  ],
  // JSON-shaped fields.
  [
    /"(authorization|api[-_]?key|secret[-_]?key|access[-_]?key|secret|token|password|cookie|x-amz[a-z-]*)"\s*:\s*"[^"]*"/gi,
    '"$1": "[redacted]"',
  ],
];

function maskToken(match: string): string {
  if (match.length <= 8) return match;
  const prefix = match.substring(0, 4);
  const suffix = match.substring(match.length - 4);
  return `${prefix}${"*".repeat(match.length - 8)}${suffix}`;
}

/**
 * Redacts sensitive material from arbitrary text. Used for both debug logging
 * (where prefix/suffix masking preserves debuggability) and provider error
 * context (where echoed auth headers, query-string secrets, and JSON-shaped
 * fields need full redaction).
 */
export function redactSecrets(input: string): string {
  let out = input.replace(TOKEN_MASK_REGEX, maskToken);
  for (const [pattern, replacement] of FULL_REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// Back-compat alias. Existing call sites and tests still reference `maskApiKeys`.
export const maskApiKeys = redactSecrets;

// Query-string parameters that are well-known to carry credentials in URLs.
// Google Gemini puts ?key=<API key>, AWS Sig v4 query auth uses
// X-Amz-Signature/X-Amz-Security-Token, OAuth callbacks include access_token, etc.
const SECRET_URL_QUERY_KEYS: ReadonlySet<string> = new Set([
  "key",
  "api_key",
  "apikey",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "client_secret",
  "password",
  "x-amz-signature",
  "x-amz-security-token",
  "x-amz-credential",
  "signature",
]);

/**
 * Returns a URL string safe to embed in error messages or context. Redacts
 * known secret-bearing query params (Google's ?key=, AWS Sig v4 query auth,
 * OAuth tokens, etc.), then runs the result through `redactSecrets` so any
 * path-segment or non-query secret patterns (sk-..., Bearer ..., AKIA...)
 * also get caught.
 */
export function safeRequestUrl(url: string): string {
  if (typeof url !== "string" || !url) return url;
  let working = url;
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SECRET_URL_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "[redacted]");
      }
    }
    working = parsed.toString();
  } catch {
    // URL parsing failed (relative URL, etc.) — fall through to redactSecrets.
  }
  return redactSecrets(working);
}
