import { debug } from "./debug";
import { isValidUrl } from "./isValidUrl";
import { LlmExeError } from "@/errors";
import {
  safeProviderErrorBody,
  safeResponseHeaders,
  parseProviderErrorGeneric,
  safeProviderString,
} from "@/errors";
import { safeRequestUrl } from "./redactSecrets";

export interface ApiRequestResponse<T> {
  data: T;
  headers: Record<string, string>;
}

export function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

/**
 * Makes an API request with the given URL and options.
 *
 * Returns the parsed body plus response headers. Throws an `LlmExeError` with
 * code `request.invalid_url` for URL validation failures and
 * `request.http_error` for fetch failures and non-OK HTTP responses. Non-OK
 * responses preserve `status`, `statusText`, `url`, safe `responseHeaders`,
 * scrubbed `providerErrorBody` / `providerErrorRaw`, and a normalized
 * `providerError` in context. The thrown error stays generic — callers
 * (llm.call.ts, embedding.call.ts) decide whether to re-wrap as a
 * domain-specific provider code.
 */
export async function apiRequest<T extends Record<string, any> | null>(
  url: string,
  options?: Omit<RequestInit, "headers"> & {
    headers: Record<string, any>;
  }
): Promise<ApiRequestResponse<T>> {
  const finalOptions: RequestInit = {
    ...options,
  };

  debug(url, finalOptions);

  if (!url || !isValidUrl(url)) {
    const safeUrl = safeRequestUrl(url);
    throw new LlmExeError("Invalid URL", {
      code: "request.invalid_url",
      context: {
        operation: "apiRequest",
        url: safeUrl,
        expected: "valid URL",
      },
    });
  }

  let response: Response;
  try {
    response = await fetch(url, finalOptions);
  } catch (fetchError) {
    /* istanbul ignore next */
    const innerMsg = fetchError instanceof Error ? fetchError.message : "Error";
    // URL may contain credentials in the query string (Google's ?key=...,
    // AWS Sig v4 query auth, OAuth tokens). Scrub once and use this everywhere
    // the URL goes into a thrown error's message or context.
    const safeUrl = safeRequestUrl(url);
    throw new LlmExeError(`Request to ${safeUrl} failed: ${innerMsg}`, {
      code: "request.http_error",
      context: {
        operation: "apiRequest",
        url: safeUrl,
      },
      cause: fetchError,
    });
  }

  if (!response.ok) {
    let bodyText = "";
    let bodyJson: unknown = undefined;
    let bodyReadError: unknown = undefined;
    try {
      bodyText = await response.text();
      if (bodyText) {
        try {
          bodyJson = JSON.parse(bodyText);
        } catch {
          // body wasn't JSON; fall back to raw text
        }
      }
    } catch (e) {
      bodyReadError = e;
    }

    // Build the legacy message (preserved verbatim for back-compat). The
    // extracted detail is scrubbed before interpolation because providers
    // can echo Authorization headers, API keys, or signed values in error
    // bodies. Without this, e.message would leak to logs.
    let message: string;
    if (bodyText) {
      let detail: unknown = bodyText;
      if (bodyJson) {
        const b = bodyJson as {
          error?: { message?: unknown } | string | unknown;
          message?: unknown;
        };
        detail =
          (b.error as { message?: unknown } | undefined)?.message ||
          b.error ||
          b.message ||
          bodyText;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      }
      const safeDetail = safeProviderString(detail as string) ?? "";
      message = `HTTP error. Status Code: ${response.status}. Error Message: ${safeDetail}`;
    } else {
      message = `HTTP error. Status: ${response.status}. Error Message: ${
        response.statusText || "Unknown error."
      }`;
    }
    // URL may contain credentials in the query string (Google's ?key=...,
    // AWS Sig v4 query auth, OAuth tokens). Scrub once and use this everywhere
    // the URL goes into a thrown error's message or context.
    const safeUrl = safeRequestUrl(url);
    const wrappedMessage = `Request to ${safeUrl} failed: ${message}`;

    // Build structured context. Body is scrubbed before storage; raw text is
    // both truncated and scrubbed by safeProviderErrorBody.
    const safeHeaders = safeResponseHeaders(response.headers);
    const providerError = parseProviderErrorGeneric({
      status: response.status,
      statusText: response.statusText,
      headers: safeHeaders,
      bodyJson,
      bodyText,
    });

    throw new LlmExeError(wrappedMessage, {
      code: "request.http_error",
      context: {
        operation: "apiRequest",
        url: safeUrl,
        status: response.status,
        statusText: response.statusText,
        responseHeaders: safeHeaders,
        providerError,
        providerErrorBody:
          bodyJson !== undefined
            ? safeProviderErrorBody(bodyJson)
            : undefined,
        providerErrorRaw: bodyText
          ? (safeProviderErrorBody(bodyText) as string)
          : undefined,
      },
      cause: bodyReadError,
    });
  }

  const contentType = response.headers.get("content-type");
  const headers = headersToRecord(response.headers);

  if (contentType?.includes("application/json")) {
    const responseData = await response.json();
    return { data: responseData as T, headers };
  }

  // Handle non-JSON responses as text for backward compatibility.
  // Callers expecting objects should handle string responses appropriately.
  const responseData = await response.text();
  return {
    data: responseData as unknown as T,
    headers,
  };
}
