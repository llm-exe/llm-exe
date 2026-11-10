import { loadConfigFromFile } from "@/config/fromFile";
import { loadConfigFromUrl } from "@/config/fromUrl";
import { executorFromConfig } from "@/config/assemble";
import type {
  ExecutorConfigPatch,
  ProviderKey,
} from "@/config/types";
import type { CreateParserType } from "@/interfaces/parser";
import { isLlmExeError } from "@/errors";
import { parseArgs } from "./args";

/**
 * Injectable IO so the CLI core is testable without touching `process` or
 * spawning a subprocess. The thin `cli.ts` wrapper supplies the real streams.
 */
export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  /** Read piped stdin to a string. Resolve "" when there is no pipe (TTY). */
  readStdin(): Promise<string>;
  version: string;
}

const HELP = `llm-exe — run an llm-exe config file (no code required)

Usage:
  llm-exe <path> [options]
  cat input | llm-exe <path> --stdin <key>

Arguments:
  <path>                  Path to a config file (.json, .yml, .yaml, .md),
                          or an http(s) URL with --remote

Options:
  --data.<key> <value>    Set a template variable (dotted keys nest)
  --model <value>         Override the config's model
  --provider <value>      Override the config's provider
  --parser <value>        Override the config's parser
  --stdin <key>           Bind piped stdin to a data variable
  --json                  Print { result, metadata } as JSON to stdout
  --debug                 Print execution metadata to stderr
  --remote                Allow fetching a config from an http(s) URL
  -h, --help              Show this help
  -v, --version           Show version

Auth uses the same environment variables as the package
(OPENAI_API_KEY, ANTHROPIC_API_KEY, ...). The result goes to stdout;
metadata and errors go to stderr, so it composes with pipes.`;

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}

/**
 * Run the CLI. Returns a process exit code; never throws.
 */
export async function runCli(argv: string[], io: CliIO): Promise<number> {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    io.stderr((error as Error).message);
    io.stderr("Run `llm-exe --help` for usage.");
    return 1;
  }

  if (args.help) {
    io.stdout(HELP);
    return 0;
  }
  if (args.version) {
    io.stdout(io.version);
    return 0;
  }
  if (!args.path) {
    io.stderr("Missing config path.");
    io.stderr("Usage: llm-exe <path> [options] — see `llm-exe --help`.");
    return 1;
  }

  if (isUrl(args.path) && !args.remote) {
    io.stderr(
      `Refusing to fetch a remote config without --remote: ${args.path}`
    );
    return 1;
  }

  try {
    // stdin is read lazily — only when --stdin is requested — so we never block
    // waiting on a pipe that isn't there.
    const data: Record<string, unknown> = { ...args.data };
    if (args.stdinKey) {
      data[args.stdinKey] = await io.readStdin();
    }

    const patch: ExecutorConfigPatch = {};
    if (args.model !== undefined) patch.model = args.model;
    // Untrusted strings — normalizeConfig validates `provider` against the known
    // set and createParser owns parser-name errors, so the cast is honest here.
    if (args.provider !== undefined) patch.provider = args.provider as ProviderKey;
    if (args.parser !== undefined) patch.parser = args.parser as CreateParserType;
    if (Object.keys(data).length > 0) patch.data = data;

    const config = isUrl(args.path)
      ? await loadConfigFromUrl(args.path, patch)
      : await loadConfigFromFile(args.path, patch);

    let metadata: unknown;
    const executor = executorFromConfig(config, {
      hooks: {
        onComplete(meta: unknown) {
          metadata = meta;
        },
      },
    });

    const result = await executor.execute(
      (config.data ?? {}) as any,
      config.executorOptions
    );

    if (args.debug) {
      io.stderr(JSON.stringify(metadata, null, 2));
    }
    if (args.json) {
      io.stdout(JSON.stringify({ result, metadata }, null, 2));
    } else {
      io.stdout(formatResult(result));
    }
    return 0;
  } catch (error) {
    if (isLlmExeError(error)) {
      io.stderr(`Error [${error.code}]: ${error.message}`);
    } else {
      io.stderr(`Error: ${(error as Error)?.message ?? String(error)}`);
    }
    return 1;
  }
}
