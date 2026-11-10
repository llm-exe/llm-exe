// Pure argument parser for the llm-exe CLI. No process/IO access — takes the
// argv tail (process.argv.slice(2)) and returns a plain result, or throws a
// descriptive Error on malformed input. Kept dependency-free on purpose: the
// only non-trivial bit is `--data.<dotted.key>`, which a generic arg library
// wouldn't handle anyway.

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface ParsedArgs {
  /** Positional config path or URL. */
  path?: string;
  /** Values collected from `--data.<key>` (and later `--stdin`). */
  data: Record<string, unknown>;
  model?: string;
  provider?: string;
  parser?: string;
  /** `--stdin <key>`: bind piped stdin to this data variable. */
  stdinKey?: string;
  json: boolean;
  debug: boolean;
  remote: boolean;
  help: boolean;
  version: boolean;
}

// flag name -> ParsedArgs boolean field
const BOOLEAN_FLAGS: Record<string, "json" | "debug" | "remote" | "help" | "version"> =
  {
    json: "json",
    debug: "debug",
    remote: "remote",
    help: "help",
    h: "help",
    version: "version",
    v: "version",
  };

const VALUE_FLAGS = new Set(["model", "provider", "parser", "stdin"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function setNested(
  target: Record<string, unknown>,
  dottedKey: string,
  value: unknown
): void {
  const parts = dottedKey.split(".").filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error("Use --data.<key> <value>, e.g. --data.name World");
  }
  for (const part of parts) {
    if (FORBIDDEN_KEYS.has(part)) {
      throw new Error(`Illegal key "${part}" in --data.${dottedKey}`);
    }
  }
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isPlainObject(node[part])) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    data: {},
    json: false,
    debug: false,
    remote: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (!token.startsWith("-")) {
      if (result.path !== undefined) {
        throw new Error(`Unexpected argument: ${token}`);
      }
      result.path = token;
      continue;
    }

    const raw = token.replace(/^--?/, "");
    const eq = raw.indexOf("=");
    const name = eq === -1 ? raw : raw.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : raw.slice(eq + 1);

    if (name in BOOLEAN_FLAGS) {
      if (inlineValue !== undefined) {
        throw new Error(`Option --${name} does not take a value`);
      }
      result[BOOLEAN_FLAGS[name]] = true;
      continue;
    }

    const takeValue = (): string => {
      if (inlineValue !== undefined) return inlineValue;
      i++;
      if (i >= argv.length) {
        throw new Error(`Option --${name} requires a value`);
      }
      return argv[i];
    };

    if (name === "data") {
      throw new Error("Use --data.<key> <value>, e.g. --data.name World");
    }
    if (name.startsWith("data.")) {
      setNested(result.data, name.slice("data.".length), takeValue());
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      const value = takeValue();
      if (name === "stdin") result.stdinKey = value;
      else if (name === "model") result.model = value;
      else if (name === "provider") result.provider = value;
      else if (name === "parser") result.parser = value;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return result;
}
