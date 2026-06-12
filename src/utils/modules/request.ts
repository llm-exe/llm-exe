import { debug } from "./debug";
import { isValidUrl } from "./isValidUrl";

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
 * Makes an API request with the given URL and options, using a persistent HTTPS agent.
 *
 * @param {string} url - The endpoint to which the request is sent.
 * @param {RequestInit} [options] - Optional custom request options.
 * @returns {Promise<ApiRequestResponse<T>>} The parsed body + headers
 * @throws Will throw an error if the HTTP request fails.
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

  try {
    debug(url, finalOptions);

    if(!url || !isValidUrl(url)) {
      throw new Error("Invalid URL");
    }

    const response: Response = await fetch(url, finalOptions);
    if (!response.ok) {
      let message = `HTTP error. Status: ${response.status}. Error Message: ${
        response?.statusText || "Unknown error."
      }`;
      try {
        const text = await response.text();
        if (text) {
          let detail = text;
          try {
            const body = JSON.parse(text);
            detail =
              body?.error?.message ||
              body?.error ||
              body?.message ||
              text;
            if (typeof detail !== "string") detail = JSON.stringify(detail);
          } catch {
            // body wasn't JSON; fall back to raw text
          }
          message = `HTTP error. Status Code: ${response.status}. Error Message: ${detail}`;
        }
      } catch {
        // body unreadable; keep default message
      }
      throw new Error(message);
    }

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const responseData = await response.json();
      return { data: responseData as T, headers: headersToRecord(response.headers) };
    } else {
      // Handle non-JSON responses as text for backward compatibility
      // Callers expecting objects should handle string responses appropriately
      const responseData = await response.text();
      return {
        data: responseData as unknown as T,
        headers: headersToRecord(response.headers),
      };
    }
  } catch (error: unknown) {
    /* istanbul ignore next */
    const message = error instanceof Error ? error.message : "Error";
    throw new Error(`Request to ${url} failed: ${message}`);
  }
}
