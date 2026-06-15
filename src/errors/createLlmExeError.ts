import { LlmExeError } from "./LlmExeError";
import type { ErrorCodes, ErrorContextByCode } from "./types";

const DOCS_BASE_URL = "https://llm-exe.com";

export type ErrorDefinition<
  C extends ErrorCodes,
  Context extends ErrorContextByCode[C]
> = {
  code: C;
  message: (context: Context) => string;
  resolution?: string | ((context: Context) => string);
  docsPath?: string | ((context: Context) => string);
};

function resolveDefinitionValue<Context>(
  value: string | ((context: Context) => string) | undefined,
  context: Context
): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "function" ? value(context) : value;
}

function resolveDocsUrl(docsPath: string): string {
  if (/^https?:\/\//i.test(docsPath)) return docsPath;
  return `${DOCS_BASE_URL}${docsPath.startsWith("/") ? "" : "/"}${docsPath}`;
}

export function createLlmExeError<
  C extends ErrorCodes,
  Context extends ErrorContextByCode[C] = ErrorContextByCode[C]
>(
  definition: ErrorDefinition<C, Context>,
  context: Context,
  options?: { cause?: unknown }
): LlmExeError<C> {
  const message = definition.message(context);
  const resolution = resolveDefinitionValue(definition.resolution, context);
  const docsPath = resolveDefinitionValue(definition.docsPath, context);
  const docsUrl = docsPath ? resolveDocsUrl(docsPath) : undefined;

  const mergedContext = {
    ...(context as object),
    ...(resolution !== undefined ? { resolution } : null),
    ...(docsPath !== undefined ? { docsPath } : null),
    ...(docsUrl !== undefined ? { docsUrl } : null),
  } as ErrorContextByCode[C];

  return new LlmExeError<C>(message, {
    code: definition.code,
    context: mergedContext,
    cause: options?.cause,
  });
}
