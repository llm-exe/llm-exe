import { Config } from "@/types";

const warned = new Set<string>();

export interface DeprecationContext {
  executorName?: string;
  traceId?: string;
}

export function emitDeprecationWarning(
  config: Config<any>,
  context?: DeprecationContext
): void {
  if (!config.deprecated) return;
  if (
    typeof process !== "object" ||
    typeof process?.emitWarning !== "function"
  ) {
    return;
  }
  const { shorthand, message } = config.deprecated;
  if (warned.has(shorthand)) return;
  warned.add(shorthand);

  const detail = JSON.stringify({
    shorthand,
    model: config.options?.model?.default,
    provider: config.provider,
    executorName: context?.executorName,
    traceId: context?.traceId,
  });

  process.emitWarning(message, {
    type: "DeprecationWarning",
    code: "LLM_EXE_DEPRECATED",
    detail,
  });
}

export function deprecateShorthand<K extends string>(
  shorthand: K,
  args: {
    config: Config<any>;
    message: string;
  }
): Record<K, Config<any>> {
  const entry: Config<any> = {
    ...args.config,
    deprecated: Object.freeze({
      shorthand,
      message: args.message,
    }),
  };
  return { [shorthand]: entry } as Record<K, Config<any>>;
}

export function _resetDeprecationWarnings(): void {
  warned.clear();
}
