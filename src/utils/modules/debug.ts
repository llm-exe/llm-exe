import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { maskApiKeys, safeRequestUrl } from "./redactSecrets";

export function isDebugEnabled() {
  const debugValue = getEnvironmentVariable("LLM_EXE_DEBUG");

  return (
    typeof debugValue === "string" &&
    debugValue !== "" &&
    debugValue.toLowerCase() !== "undefined" &&
    debugValue.toLowerCase() !== "null"
  );
}

export function debug(...args: any[]) {
  // Short-circuit when debug is off so the loop below (JSON.stringify,
  // regex scrubbing, etc.) doesn't run on every successful request.
  if (!isDebugEnabled()) {
    return;
  }

  const logs = [];

  for (const arg of args) {
    if (arg && typeof arg === "object") {
      if (arg instanceof Error) {
        // nothing
      } else if (arg instanceof Array) {
        logs.push(arg.map((item) => JSON.stringify(item, null, 2)));
      } else if (arg instanceof Map) {
        logs.push(
          Array.from(arg.entries()).map(
            ([key, value]) => `${key}: ${JSON.stringify(value, null, 2)}`,
          ),
        );
      } else if (arg instanceof Set) {
        logs.push(Array.from(arg).map((item) => JSON.stringify(item, null, 2)));
      } else if (arg instanceof Date) {
        logs.push(arg.toISOString());
      } else if (arg instanceof RegExp) {
        logs.push(arg.toString());
      } else {
        try {
          // Always scrub stringified object args. The previous Authorization-
          // only conditional missed common cases like Anthropic's lowercase
          // x-api-key. Cost is one regex pass; we're already inside the
          // debug-enabled short-circuit.
          const str = maskApiKeys(JSON.stringify(arg, null, 2));
          logs.push(str);
        } catch (error) {
          console.error("Error parsing object:", error);
        }
      }
    } else if (typeof arg === "string") {
      // String args get scrubbed too. safeRequestUrl handles URLs (Google
      // ?key=...) and falls back to redactSecrets for non-URL strings, so
      // it's a superset of maskApiKeys for arbitrary string input.
      logs.push(safeRequestUrl(arg));
    } else {
      logs.push(arg);
    }
  }
  if (isDebugEnabled()) {
    console.debug(...logs);
  }
}
