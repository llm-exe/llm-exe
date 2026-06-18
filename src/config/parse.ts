import { load as parseYaml } from "js-yaml";
import { normalizeConfig } from "./normalize";
import type { ExecutorConfig, ExecutorConfigPatch, Format } from "./types";
import { configParseFailedError, configInvalidError } from "./errors";

// CRLF-tolerant: `\n`-only silently misses Windows-authored files.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function snippetOf(source: string): string {
  return source.length > 120 ? `${source.slice(0, 120)}…` : source;
}

/**
 * Infer a format from a file path or URL extension. Strips URL query/hash.
 * Returns `undefined` when the extension is unrecognized (caller falls to "auto").
 */
export function formatFromExtension(pathOrUrl: string): Format | undefined {
  const clean = pathOrUrl.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  if (dot === -1) return undefined;
  switch (clean.slice(dot).toLowerCase()) {
    case ".json":
      return "json";
    case ".yml":
    case ".yaml":
      return "yaml";
    case ".md":
    case ".markdown":
      return "markdown";
    default:
      return undefined;
  }
}

function parseJsonSource(
  source: string,
  patch: ExecutorConfigPatch
): ExecutorConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (cause) {
    throw configParseFailedError(
      { format: "json", snippet: snippetOf(source) },
      { cause }
    );
  }
  return normalizeConfig(parsed, patch);
}

function parseYamlSource(
  source: string,
  patch: ExecutorConfigPatch
): ExecutorConfig {
  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch (cause) {
    throw configParseFailedError(
      { format: "yaml", snippet: snippetOf(source) },
      { cause }
    );
  }
  return normalizeConfig(parsed, patch);
}

function parseMarkdownSource(
  source: string,
  patch: ExecutorConfigPatch
): ExecutorConfig {
  const match = FRONTMATTER_RE.exec(source);
  let frontmatter: Record<string, unknown> = {};
  let body = source;

  if (match) {
    const [, fmBlock, bodyBlock] = match;
    let parsed: unknown;
    try {
      parsed = parseYaml(fmBlock);
    } catch (cause) {
      throw configParseFailedError(
        { format: "markdown", snippet: snippetOf(fmBlock) },
        { cause }
      );
    }
    frontmatter = isRecord(parsed) ? parsed : {};
    body = bodyBlock;
  }

  const trimmedBody = body.trim();
  const fmMessage =
    typeof frontmatter.message === "string" ? frontmatter.message.trim() : "";

  // Body wins. Both non-empty is an ambiguous source — reject.
  if (fmMessage !== "" && trimmedBody !== "") {
    throw configInvalidError({
      field: "message",
      expected: "either frontmatter `message` or a markdown body, not both",
    });
  }

  const object: Record<string, unknown> = { ...frontmatter };
  if (trimmedBody !== "") {
    object.message = trimmedBody;
  }

  return normalizeConfig(object, patch);
}

function parseAutoSource(
  source: string,
  patch: ExecutorConfigPatch
): ExecutorConfig {
  // Best-effort, documented as such. Explicit `format` is the recommended path.
  // We commit to the first format that parses SYNTACTICALLY — so a config that
  // parses but fails validation surfaces the real `invalid_config`, not a
  // generic `parse_failed`. Order: JSON (unambiguous), then markdown when a
  // frontmatter fence is present (`---` is a YAML doc separator, so YAML would
  // choke on it), then YAML.
  let jsonParsed: unknown;
  let jsonOk = false;
  try {
    jsonParsed = JSON.parse(source);
    jsonOk = true;
  } catch {
    // not JSON — try the next format
  }
  if (jsonOk) {
    return normalizeConfig(jsonParsed, patch);
  }

  if (FRONTMATTER_RE.test(source)) {
    return parseMarkdownSource(source, patch);
  }

  let yamlParsed: unknown;
  let yamlOk = false;
  try {
    yamlParsed = parseYaml(source);
    yamlOk = isRecord(yamlParsed);
  } catch {
    // not YAML either
  }
  if (yamlOk) {
    return normalizeConfig(yamlParsed, patch);
  }

  throw configParseFailedError({ format: "auto", snippet: snippetOf(source) });
}

/**
 * Parse a config from an in-memory string in a known (or auto-detected) format.
 * Async for surface uniformity with the file/URL loaders. Browser-safe.
 */
export async function parseExecutorConfig(
  source: string,
  opts: { format: Format } & ExecutorConfigPatch
): Promise<ExecutorConfig> {
  const { format, ...patch } = opts;
  switch (format) {
    case "json":
      return parseJsonSource(source, patch);
    case "yaml":
      return parseYamlSource(source, patch);
    case "markdown":
      return parseMarkdownSource(source, patch);
    case "auto":
      return parseAutoSource(source, patch);
    default:
      // exhaustive — `format` is typed `Format`
      return parseAutoSource(source, patch);
  }
}
