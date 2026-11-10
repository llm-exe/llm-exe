import { createLlmExeError } from "@/errors";
import { parseExecutorConfig, formatFromExtension } from "./parse";
import type { ExecutorConfig, ExecutorConfigPatch, Format } from "./types";

/**
 * Load a config from a URL. `fetch` defaults to the global but is injectable
 * (testable without network). The library never chooses the URL — the caller
 * does — so the trust decision is the caller's. Browser-safe.
 */
export async function loadConfigFromUrl(
  url: string,
  opts: {
    fetch?: typeof fetch;
    init?: RequestInit;
    format?: Format;
  } & ExecutorConfigPatch = {}
): Promise<ExecutorConfig> {
  const { fetch: fetchImpl, init, format, ...patch } = opts;
  const doFetch = fetchImpl ?? globalThis.fetch;

  if (typeof doFetch !== "function") {
    throw createLlmExeError(
      {
        code: "request.http_error",
        message: () =>
          `No fetch implementation available to load config from "${url}".`,
        resolution:
          "Pass a `fetch` implementation in options, or run on a platform with a global fetch.",
      },
      { url }
    );
  }

  const response = await doFetch(url, init);
  if (!response.ok) {
    throw createLlmExeError(
      {
        code: "request.http_error",
        message: (ctx) =>
          `Failed to fetch config from "${ctx.url}": ${ctx.status ?? ""} ${
            ctx.statusText ?? ""
          }`.trim(),
        resolution: "Check the URL is reachable and returns the config body.",
      },
      { url, status: response.status, statusText: response.statusText }
    );
  }

  const text = await response.text();
  const resolvedFormat = format ?? formatFromExtension(url) ?? "auto";
  return parseExecutorConfig(text, { format: resolvedFormat, ...patch });
}
