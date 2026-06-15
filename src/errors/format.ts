const DEFAULT_VALUE_MAX_LENGTH = 200;
const DEFAULT_LIST_MAX_ITEMS = 8;

function truncate(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s;
  return s.slice(0, Math.max(0, maxLength - 1)) + "…";
}

function compactJson(value: unknown): string | undefined {
  try {
    const seen = new WeakSet<object>();
    const replacer = (_key: string, val: unknown) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "function") return "[Function]";
      if (typeof val === "symbol") return String(val);
      if (val && typeof val === "object") {
        if (seen.has(val as object)) return "[Circular]";
        seen.add(val as object);
      }
      return val;
    };
    return JSON.stringify(value, replacer);
  } catch {
    return undefined;
  }
}

export function formatErrorValue(
  value: unknown,
  options?: { maxLength?: number }
): string {
  const maxLength = options?.maxLength ?? DEFAULT_VALUE_MAX_LENGTH;

  if (value === null) return "null";
  if (value === undefined) return "undefined";

  const t = typeof value;
  if (t === "string") {
    const s = value as string;
    return `"${truncate(s, Math.max(2, maxLength - 2))}"`;
  }
  if (t === "number") {
    const n = value as number;
    return Number.isFinite(n) ? String(n) : "null";
  }
  if (t === "boolean") return value ? "true" : "false";
  if (t === "bigint") return (value as bigint).toString();
  if (t === "symbol") return String(value);
  if (t === "function") {
    const name = (value as { name?: string }).name;
    return name ? `[Function ${name}]` : "[Function]";
  }

  const json = compactJson(value);
  if (json !== undefined) return truncate(json, maxLength);

  const tag = Object.prototype.toString.call(value).slice(8, -1);
  return `[object ${tag}]`;
}

export function formatErrorList(
  values: unknown[],
  options?: { maxItems?: number; maxLength?: number }
): string {
  const maxItems = options?.maxItems ?? DEFAULT_LIST_MAX_ITEMS;
  const maxLength = options?.maxLength;

  if (!values || values.length === 0) return "";

  const limit = Math.min(values.length, maxItems);
  const parts: string[] = [];
  for (let i = 0; i < limit; i++) {
    parts.push(formatErrorValue(values[i], maxLength ? { maxLength } : undefined));
  }
  if (values.length > limit) {
    parts.push(`… (${values.length - limit} more)`);
  }
  return parts.join(", ");
}

export function formatLlmExeErrorForLog(error: unknown): string {
  if (!error || typeof error !== "object") {
    return formatErrorValue(error);
  }

  const e = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    category?: unknown;
    cause?: unknown;
  };

  const name = typeof e.name === "string" && e.name ? e.name : "Error";
  const message = typeof e.message === "string" ? e.message : "";
  const code = typeof e.code === "string" ? e.code : undefined;
  const category = typeof e.category === "string" ? e.category : undefined;

  let header: string;
  if (code) {
    header = `${name} [${code}]: ${message}`;
  } else if (category) {
    header = `${name} [${category}]: ${message}`;
  } else {
    header = `${name}: ${message}`;
  }

  const chain: string[] = [];
  let current: unknown = e.cause;
  let depth = 0;
  const seen = new WeakSet<object>();
  while (current && depth < 5) {
    if (typeof current === "object") {
      if (seen.has(current as object)) {
        chain.push("Caused by: [Circular]");
        break;
      }
      seen.add(current as object);
    }
    const c = current as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    const cName = typeof c.name === "string" && c.name ? c.name : "Error";
    const cMsg = typeof c.message === "string" ? c.message : String(current);
    const cCode = typeof c.code === "string" ? c.code : undefined;
    chain.push(
      cCode
        ? `Caused by: ${cName} [${cCode}]: ${cMsg}`
        : `Caused by: ${cName}: ${cMsg}`
    );
    current = c.cause;
    depth++;
  }

  return chain.length > 0 ? `${header}\n${chain.join("\n")}` : header;
}
