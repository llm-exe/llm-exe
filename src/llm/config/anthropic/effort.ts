import { PROVIDED_OPTION_KEYS } from "@/llm/_utils.stateFromOptions";

// When llm-exe silently escalates the caller's "high" effort to "xhigh" for the
// Opus coding flagships (4.7 / 4.8), adaptive thinking needs more room than the
// default max_tokens or the response truncates mid-thought (issue #712).
// Anthropic's guidance for xhigh is to allow a large max_tokens (~64k), so we
// raise the ceiling to 65536 for that escalated case, but only when the caller
// did not set maxTokens themselves. max_tokens is a ceiling, not a target: the
// model stops when it is done, so a higher ceiling only adds headroom against
// truncation and does not force longer (costlier) generations.
export const ESCALATED_EFFORT_MIN_MAX_TOKENS = 65536;

// Models that 400 if temperature / top_p / top_k are set to non-default values.
export const MODELS_REJECTING_SAMPLING_PARAMS = [
  "claude-opus-5",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-fable-5",
];

// Normalize a provider model identifier to the canonical "claude-..." name the
// gates below match against. The direct Anthropic API uses bare names
// ("claude-opus-4-8"); Amazon Bedrock uses invoke identifiers such as
// "us.anthropic.claude-opus-4-8", "global.anthropic.claude-opus-5", or
// "anthropic.claude-sonnet-4-5-20250929-v1:0". Both the anthropic.chat and
// amazon:anthropic.chat providers share this effort logic, so strip a leading
// "[<geo>.]anthropic." prefix and return the "claude-..." core; bare names pass
// through unchanged.
//
// The prefix is anchored at the start so a name that merely contains the
// substring (e.g. a custom "my-anthropic.claude-proxy") is left untouched.
// Opaque identifiers with no recognizable "claude-..." (a raw provisioned or
// custom-model ARN) return unchanged and therefore match no gate: effort/thinking
// is not applied and sampling params are not dropped for them. Model IDs are
// expected in their standard lowercase form (all real Anthropic/Bedrock IDs are).
export function canonicalAnthropicModel(model: string): string {
  if (!model) return "";
  const match = /^(?:[a-z]+\.)?anthropic\.(claude-.+)$/.exec(model);
  return match ? match[1] : model;
}

// Family match on a canonicalized model name: exact, or a dated snapshot /
// version-suffixed variant ("<name>-..."). The trailing dash boundary keeps
// "claude-opus-4-8" from matching an unrelated "claude-opus-4-80"-style name, and
// is applied uniformly to every gate (adaptive, legacy, escalation, and the
// sampling-param reject list) so they cannot disagree.
const matchesModel = (canonical: string, name: string): boolean =>
  canonical === name || canonical.startsWith(`${name}-`);

const modelRejectsSamplingParams = (model: string): boolean => {
  const canonical = canonicalAnthropicModel(model);
  return MODELS_REJECTING_SAMPLING_PARAMS.some((name) =>
    matchesModel(canonical, name)
  );
};

// Claude 4.x rejects requests that set both temperature and top_p; keep temperature.
export const isClaude4x = (model: string) =>
  /^claude-(opus|sonnet|haiku)-4-/.test(canonicalAnthropicModel(model));

export const dropIfModelRejectsSamplingParams = (
  v: any,
  body: Record<string, any>
) => (modelRejectsSamplingParams(body.model) ? undefined : v);

export const topPTransform = (v: any, body: Record<string, any>) => {
  if (modelRejectsSamplingParams(body.model)) return undefined;
  if (isClaude4x(body.model) && body.temperature !== undefined) return undefined;
  return v;
};

// Maps the caller's `effort` to the provider's thinking/effort request shape.
// Shared by the direct Anthropic (anthropic.chat) and Bedrock
// (amazon:anthropic.chat) configs: both send `output_config.effort` and
// `thinking` as top-level body keys in the same JSON shape, so one
// implementation serves both. Model gating is applied to the canonicalized
// model name, so Bedrock invoke IDs are matched the same as bare direct names.
export const effortTransform = (
  v: unknown,
  _s: Record<string, any>,
  _output: Record<string, any>
) => {
  if (
    typeof v !== "string" ||
    !["minimal", "low", "medium", "high"].includes(v)
  ) {
    return undefined;
  }

  const model = canonicalAnthropicModel(_s.model || "");

  const isAdaptive =
    matchesModel(model, "claude-opus-5") ||
    matchesModel(model, "claude-opus-4-6") ||
    matchesModel(model, "claude-opus-4-7") ||
    matchesModel(model, "claude-opus-4-8") ||
    matchesModel(model, "claude-sonnet-4-6") ||
    matchesModel(model, "claude-sonnet-5") ||
    matchesModel(model, "claude-fable-5");

  if (isAdaptive) {
    // Opus 5 already runs adaptive thinking when `thinking` is omitted; sending
    // it explicitly is equivalent and keeps one code path for the whole adaptive
    // generation (4.6/4.7/4.8 need it stated to think).
    _output.thinking = { type: "adaptive" };
    const map: Record<string, string> = {
      minimal: "low",
      low: "low",
      medium: "medium",
      // Opus 4.7 and 4.8 escalate "high" to "xhigh": Anthropic's per-model
      // guidance is to start with xhigh for coding/agentic work on those. Opus 5
      // is deliberately NOT escalated: Anthropic recommends starting with "high"
      // (the default) on Opus 5 and explicitly warns against carrying the 4.x
      // effort escalation over, so "high" must stay reachable. All other adaptive
      // models also map "high" -> "high".
      high:
        matchesModel(model, "claude-opus-4-7") ||
        matchesModel(model, "claude-opus-4-8")
          ? "xhigh"
          : "high",
    };
    const mapped = map[v];

    // Only the high->xhigh escalation above reaches "xhigh". When WE bump the
    // caller's effort up, give adaptive thinking room so it does not truncate
    // against the default max_tokens. Fail-closed on provenance: raise the floor
    // only when we can positively confirm the caller did not set maxTokens; a
    // caller-set value (any value, including the default) is always honored, and
    // a missing provenance marker is treated as caller-set. (issue #712)
    if (mapped === "xhigh") {
      const providedKeys = (_s as any)[PROVIDED_OPTION_KEYS] as
        | Set<string>
        | undefined;
      const callerSetMaxTokens = providedKeys
        ? providedKeys.has("maxTokens")
        : true;
      const currentMax =
        typeof _output.max_tokens === "number" ? _output.max_tokens : 0;
      if (
        !callerSetMaxTokens &&
        currentMax < ESCALATED_EFFORT_MIN_MAX_TOKENS
      ) {
        _output.max_tokens = ESCALATED_EFFORT_MIN_MAX_TOKENS;
      }
    }

    return mapped;
  }

  const isLegacy =
    matchesModel(model, "claude-opus-4-5") ||
    matchesModel(model, "claude-sonnet-4-5") ||
    matchesModel(model, "claude-haiku-4-5");

  if (isLegacy) {
    const budgetMap: Record<string, number> = {
      minimal: 1024,
      low: 4096,
      medium: 10240,
      high: 32768,
    };
    const budget = budgetMap[v];
    _output.thinking = { type: "enabled", budget_tokens: budget };
    // Anthropic requires max_tokens > budget_tokens (thinking tokens count toward
    // max_tokens). The default max_tokens is <= the low/medium/high budgets,
    // which 400s. Raise max_tokens to fit the budget plus an output allowance,
    // but never lower a caller's already-larger value.
    const OUTPUT_ALLOWANCE = 4096;
    const currentMax =
      typeof _output.max_tokens === "number" ? _output.max_tokens : 0;
    if (currentMax <= budget) {
      _output.max_tokens = budget + OUTPUT_ALLOWANCE;
    }
    return undefined;
  }

  return undefined;
};
