// Caller-facing effort values, mapped to Gemini's thinking shapes below.
// Anything else is ignored (no thinking config sent).
const EFFORT_VALUES = ["minimal", "low", "medium", "high"];

// Gemini 2.5 takes a token budget for thinking.
const THINKING_BUDGETS: Record<string, number> = {
  minimal: 1024,
  low: 1024,
  medium: 8192,
  high: 24576,
};

// Gemini 3+ replaced the token budget with a named level, and uses the same
// vocabulary llm-exe exposes as `effort`, so the values pass straight through.
const THINKING_LEVELS: Record<string, string> = {
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
};

// Major version of a `gemini-<major>[.<minor>]-...` model id, or null for
// anything that is not a recognizable Gemini model name. Used instead of an
// allowlist of specific model names so new Gemini releases (which arrive faster
// than we ship shorthands, and are also reachable via the generic
// `google.chat.v1` + `model` option) keep working without a code change.
export function geminiMajorVersion(model: string): number | null {
  const match = /^gemini-(\d+)(?:\.\d+)?(?:-|$)/.exec(model || "");
  return match ? Number(match[1]) : null;
}

// Maps the caller's `effort` to Gemini's thinking request shape. Everything is
// written under `generationConfig` — that is where the REST `generateContent`
// body carries it, and where every other option in this config maps.
//
// 2.5 -> generationConfig.thinkingConfig.thinkingBudget (number)
// 3+  -> generationConfig.thinkingConfig.thinkingLevel  (string)
//
// Older families (2.0 and below) have no thinking support, so they return
// undefined and no thinking config is sent.
export const effortTransform = (
  v: unknown,
  _s: Record<string, any>,
  _output: Record<string, any>
) => {
  if (typeof v !== "string" || !EFFORT_VALUES.includes(v)) {
    return undefined;
  }

  const major = geminiMajorVersion(_s?.model);
  if (major === null) {
    return undefined;
  }

  if (major >= 3) {
    // Returned via _output because this generation uses a different key than
    // the one declared on the mapBody entry.
    _output["generationConfig.thinkingConfig.thinkingLevel"] =
      THINKING_LEVELS[v];
    return undefined;
  }

  // 2.5 is the only 2.x family with thinking support.
  if (/^gemini-2\.5(-|$)/.test(_s.model)) {
    return THINKING_BUDGETS[v];
  }

  return undefined;
};
