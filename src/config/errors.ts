import { createLlmExeError } from "@/errors";
import type {
  LlmExeError,
  ConfigParseContext,
  ConfigInvalidContext,
  ConfigFileContext,
  ConfigFormatContext,
} from "@/errors";

const DOCS_PATH = "/config";

export function configParseFailedError(
  context: ConfigParseContext,
  options?: { cause?: unknown }
): LlmExeError<"configuration.parse_failed"> {
  return createLlmExeError(
    {
      code: "configuration.parse_failed",
      message: (ctx) =>
        `Failed to parse ${ctx.format ?? "config"} configuration${
          typeof ctx.position === "number" ? ` at position ${ctx.position}` : ""
        }.`,
      resolution:
        "Check the file is valid for its format (JSON/YAML/markdown frontmatter). Pass an explicit `format` if auto-detection is guessing wrong.",
      docsPath: DOCS_PATH,
    },
    context,
    options
  );
}

export function configInvalidError(
  context: ConfigInvalidContext,
  options?: { cause?: unknown }
): LlmExeError<"configuration.invalid_config"> {
  return createLlmExeError(
    {
      code: "configuration.invalid_config",
      message: (ctx) => {
        if (ctx.schemaErrors?.length) {
          return `Invalid executor config: ${ctx.schemaErrors.join("; ")}.`;
        }
        if (ctx.field) {
          return `Invalid executor config at \`${ctx.field}\`: expected ${String(
            ctx.expected
          )}.`;
        }
        return "Invalid executor config.";
      },
      resolution:
        "Fix the listed fields. `provider` and `message` are required; `provider` must be a known useLlm key.",
      docsPath: DOCS_PATH,
    },
    context,
    options
  );
}

export function configFileNotFoundError(
  context: ConfigFileContext,
  options?: { cause?: unknown }
): LlmExeError<"configuration.file_not_found"> {
  return createLlmExeError(
    {
      code: "configuration.file_not_found",
      message: (ctx) => `Config file not found: ${ctx.path ?? "(unknown path)"}.`,
      resolution: "Check the path is correct and the file exists.",
      docsPath: DOCS_PATH,
    },
    context,
    options
  );
}

export function configFileReadFailedError(
  context: ConfigFileContext,
  options?: { cause?: unknown }
): LlmExeError<"configuration.file_read_failed"> {
  return createLlmExeError(
    {
      code: "configuration.file_read_failed",
      message: (ctx) =>
        `Failed to read config file: ${ctx.path ?? "(unknown path)"}${
          ctx.syscall ? ` (${ctx.syscall})` : ""
        }.`,
      resolution:
        "Check file permissions and that the path points to a readable file, not a directory.",
      docsPath: DOCS_PATH,
    },
    context,
    options
  );
}

export function configUnsupportedFormatError(
  context: ConfigFormatContext,
  options?: { cause?: unknown }
): LlmExeError<"configuration.unsupported_format"> {
  return createLlmExeError(
    {
      code: "configuration.unsupported_format",
      message: (ctx) =>
        `Unsupported config format${ctx.format ? `: "${ctx.format}"` : ""}.`,
      resolution: (ctx) =>
        `Use one of: ${(ctx.supported ?? ["json", "yaml", "markdown", "auto"]).join(
          ", "
        )}. Or pass an explicit \`format\`.`,
      docsPath: DOCS_PATH,
    },
    context,
    options
  );
}
