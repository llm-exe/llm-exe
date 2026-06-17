import type { JsonSafe, SerializeOptions } from "./types";

const MAX_VALUE_DEPTH = 5;
const MAX_CAUSE_DEPTH = 5;
const CIRCULAR = "[Circular]";
const SYMBOL = Symbol.for("llm-exe.error");

function isLlmExeErrorLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (
    (value as { [k: symbol]: unknown })[SYMBOL] === true ||
    (value as { isLlmExeError?: unknown }).isLlmExeError === true
  );
}

function isErrorLike(
  value: unknown,
): value is {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  cause?: unknown;
} {
  if (value instanceof Error) return true;
  if (!value || typeof value !== "object") return false;
  const v = value as { message?: unknown; name?: unknown };
  return typeof v.message === "string" && typeof v.name === "string";
}

function isResponseLike(
  value: unknown,
): value is { status: number; statusText?: string; url?: string } {
  if (!value || typeof value !== "object") return false;
  if (typeof Response !== "undefined" && value instanceof Response) return true;
  return false;
}

function describeOpaque(value: object): string {
  const tag = Object.prototype.toString.call(value).slice(8, -1);
  if (tag === "Object") return "[object Object]";
  return `[object ${tag}]`;
}

function safeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): JsonSafe {
  if (value === null) return null;
  if (value === undefined) return null;

  const t = typeof value;
  if (t === "string") return value as string;
  if (t === "boolean") return value as boolean;
  if (t === "number") {
    const n = value as number;
    return Number.isFinite(n) ? n : null;
  }
  if (t === "bigint") return (value as bigint).toString();
  if (t === "symbol") return String(value);
  if (t === "function") {
    const name = (value as { name?: string }).name;
    return name ? `[Function ${name}]` : "[Function]";
  }

  if (depth >= MAX_VALUE_DEPTH) {
    return describeOpaque(value as object);
  }

  if (seen.has(value as object)) return CIRCULAR;
  seen.add(value as object);

  try {
    if (Array.isArray(value)) {
      const arr: JsonSafe[] = [];
      for (let i = 0; i < value.length; i++) {
        arr.push(safeValue(value[i], seen, depth + 1));
      }
      return arr;
    }

    if (value instanceof Date) {
      const ts = (value as Date).getTime();
      return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
    }

    if (
      typeof Buffer !== "undefined" &&
      Buffer.isBuffer &&
      Buffer.isBuffer(value)
    ) {
      return `[Buffer length=${(value as Buffer).length}]`;
    }

    if (
      value instanceof Map ||
      value instanceof Set ||
      value instanceof WeakMap ||
      value instanceof WeakSet
    ) {
      return describeOpaque(value as object);
    }

    if (isResponseLike(value)) {
      return {
        name: "Response",
        status: (value as { status: number }).status,
        statusText: (value as { statusText?: string }).statusText ?? "",
        url: (value as { url?: string }).url ?? "",
      };
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      const ctor = (value as { constructor?: { name?: string } }).constructor;
      if (ctor && ctor.name && ctor.name !== "Object") {
        const out: { [key: string]: JsonSafe } = {};
        for (const key of Object.keys(value as object)) {
          const v = (value as { [k: string]: unknown })[key];
          if (v === undefined) continue;
          out[key] = safeValue(v, seen, depth + 1);
        }
        return Object.keys(out).length > 0
          ? out
          : describeOpaque(value as object);
      }
    }

    const out: { [key: string]: JsonSafe } = {};
    for (const key of Object.keys(value as object)) {
      const v = (value as { [k: string]: unknown })[key];
      if (v === undefined) continue;
      out[key] = safeValue(v, seen, depth + 1);
    }
    return out;
  } finally {
    seen.delete(value as object);
  }
}

function freshSafeValue(value: unknown): JsonSafe {
  return safeValue(value, new WeakSet(), 0);
}

function serializeOne(
  error: unknown,
  errorSeen: WeakSet<object>,
  causeDepth: number,
  options: SerializeOptions,
): JsonSafe {
  if (error === null || error === undefined) return null;
  if (typeof error !== "object") return freshSafeValue(error);

  if (errorSeen.has(error as object)) return CIRCULAR;
  errorSeen.add(error as object);

  try {
    if (isLlmExeErrorLike(error)) {
      const e = error as {
        message?: unknown;
        category?: unknown;
        code?: unknown;
        context?: unknown;
        cause?: unknown;
        stack?: unknown;
      };
      const out: { [key: string]: JsonSafe } = {
        name: "LlmExeError",
        message: typeof e.message === "string" ? e.message : "",
        category: typeof e.category === "string" ? e.category : "unknown",
        code: typeof e.code === "string" ? e.code : "unknown.unclassified",
      };
      if (e.context !== undefined) {
        out.context = freshSafeValue(e.context);
      }
      if (options.includeStack && typeof e.stack === "string") {
        out.stack = e.stack;
      }
      if (e.cause !== undefined) {
        if (causeDepth + 1 >= MAX_CAUSE_DEPTH) {
          out.cause = { truncated: true };
        } else {
          out.cause = serializeOne(e.cause, errorSeen, causeDepth + 1, options);
        }
      }
      return out;
    }

    if (isResponseLike(error)) {
      return {
        name: "Response",
        status: (error as { status: number }).status,
        statusText: (error as { statusText?: string }).statusText ?? "",
        url: (error as { url?: string }).url ?? "",
      };
    }

    if (isErrorLike(error)) {
      const e = error as {
        name?: unknown;
        message?: unknown;
        stack?: unknown;
        cause?: unknown;
      };
      const out: { [key: string]: JsonSafe } = {
        name: typeof e.name === "string" && e.name ? e.name : "Error",
        message: typeof e.message === "string" ? e.message : "",
      };
      if (options.includeStack && typeof e.stack === "string") {
        out.stack = e.stack;
      }
      if (e.cause !== undefined) {
        if (causeDepth + 1 >= MAX_CAUSE_DEPTH) {
          out.cause = { truncated: true };
        } else {
          out.cause = serializeOne(e.cause, errorSeen, causeDepth + 1, options);
        }
      }
      return out;
    }

    return freshSafeValue(error);
  } finally {
    errorSeen.delete(error as object);
  }
}

export function serializeLlmExeError(
  error: unknown,
  options?: SerializeOptions,
): JsonSafe {
  return serializeOne(error, new WeakSet(), 0, options ?? {});
}
