import {
  canonicalAnthropicModel,
  effortTransform,
  dropIfModelRejectsSamplingParams,
  topPTransform,
  ESCALATED_EFFORT_MIN_MAX_TOKENS,
} from "./effort";
import { PROVIDED_OPTION_KEYS } from "@/llm/_utils.stateFromOptions";

// The effort/sampling logic is shared by the direct Anthropic (anthropic.chat)
// and Bedrock (amazon:anthropic.chat) configs. The direct-provider behavior is
// covered by anthropic.test.ts (which drives config.mapBody.effort.transform,
// i.e. this same function with bare model names). These tests focus on the piece
// that only matters once Bedrock reuses it: canonicalizing Bedrock invoke model
// IDs so the model gates fire the same as for bare direct names.
describe("anthropic effort (shared direct + bedrock)", () => {
  describe("canonicalAnthropicModel", () => {
    it.each([
      // direct API bare names pass through unchanged
      ["claude-opus-4-8", "claude-opus-4-8"],
      ["claude-3-7-sonnet-20250219", "claude-3-7-sonnet-20250219"],
      // Bedrock invoke identifiers -> the claude-... core
      ["anthropic.claude-opus-4-8", "claude-opus-4-8"],
      ["us.anthropic.claude-opus-4-8", "claude-opus-4-8"],
      ["global.anthropic.claude-opus-5", "claude-opus-5"],
      ["eu.anthropic.claude-sonnet-5", "claude-sonnet-5"],
      // GovCloud cross-region profile (hyphenated geo segment)
      ["us-gov.anthropic.claude-opus-4-8", "claude-opus-4-8"],
      [
        "anthropic.claude-sonnet-4-5-20250929-v1:0",
        "claude-sonnet-4-5-20250929-v1:0",
      ],
      // edge cases
      ["", ""],
      ["some-other-model", "some-other-model"],
      // only an anchored "[<geo>.]anthropic." prefix is stripped, never a
      // mid-string occurrence, so custom/proxy ids are not mangled
      ["my-anthropic.claude-proxy", "my-anthropic.claude-proxy"],
      // inference-profile / foundation-model ARNs embed the model id and are
      // extracted, then canonicalized (issue #719)
      [
        "arn:aws:bedrock:us-east-1:123:inference-profile/us.anthropic.claude-opus-4-8-v1:0",
        "claude-opus-4-8-v1:0",
      ],
      [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
        "claude-sonnet-4-5-20250929-v1:0",
      ],
      [
        "arn:aws-us-gov:bedrock:us-gov-west-1:123:inference-profile/us-gov.anthropic.claude-opus-4-8",
        "claude-opus-4-8",
      ],
      // opaque ARN resource types carry no model id -> returned unchanged
      [
        "arn:aws:bedrock:us-east-1:1:provisioned-model/x",
        "arn:aws:bedrock:us-east-1:1:provisioned-model/x",
      ],
      [
        "arn:aws:bedrock:us-east-1:123:application-inference-profile/abc123",
        "arn:aws:bedrock:us-east-1:123:application-inference-profile/abc123",
      ],
    ])("normalizes %s -> %s", (input, expected) => {
      expect(canonicalAnthropicModel(input)).toBe(expected);
    });
  });

  describe("model matching uses a dash boundary (no adjacent-name over-match)", () => {
    it("does not treat claude-opus-4-80 as opus-4-8 (not adaptive, no effort mapping)", () => {
      const out: Record<string, any> = {};
      const r = effortTransform("high", { model: "claude-opus-4-80" }, out);
      expect(r).toBeUndefined();
      expect(out.thinking).toBeUndefined();
    });

    it("treats a dated opus-4-8 Bedrock snapshot as opus-4-8 (adaptive + xhigh) and drops top_p", () => {
      const dated = "us.anthropic.claude-opus-4-8-20260528-v1:0";
      const out: Record<string, any> = { max_tokens: 4096 };
      const r = effortTransform(
        "high",
        { model: dated, [PROVIDED_OPTION_KEYS]: new Set(["effort"]) },
        out
      );
      expect(r).toBe("xhigh");
      expect(out.thinking).toEqual({ type: "adaptive" });
      expect(dropIfModelRejectsSamplingParams(40, { model: dated })).toBeUndefined();
    });
  });

  describe("effortTransform with Bedrock model IDs", () => {
    const stateWith = (model: string, provided: string[] = []) => ({
      model,
      [PROVIDED_OPTION_KEYS]: new Set(provided),
    });

    it("escalates high->xhigh + adaptive for a Bedrock opus-4-8 id and applies the floor", () => {
      const out: Record<string, any> = { max_tokens: 10000 };
      const r = effortTransform(
        "high",
        stateWith("us.anthropic.claude-opus-4-8", ["effort"]),
        out
      );
      expect(r).toBe("xhigh");
      expect(out.thinking).toEqual({ type: "adaptive" });
      expect(out.max_tokens).toBe(ESCALATED_EFFORT_MIN_MAX_TOKENS);
    });

    it("honors an explicit maxTokens for a Bedrock opus-4-8 id when escalating", () => {
      const out: Record<string, any> = { max_tokens: 10000 };
      const r = effortTransform(
        "high",
        stateWith("us.anthropic.claude-opus-4-8", ["effort", "maxTokens"]),
        out
      );
      expect(r).toBe("xhigh");
      expect(out.max_tokens).toBe(10000);
    });

    it("keeps high (no escalation, no floor) for a Bedrock opus-5 id", () => {
      const out: Record<string, any> = { max_tokens: 10000 };
      const r = effortTransform(
        "high",
        stateWith("global.anthropic.claude-opus-5", ["effort"]),
        out
      );
      expect(r).toBe("high");
      expect(out.thinking).toEqual({ type: "adaptive" });
      expect(out.max_tokens).toBe(10000);
    });

    it("maps a Bedrock legacy sonnet-4-5 id to enabled budget thinking + raises max_tokens", () => {
      const out: Record<string, any> = { max_tokens: 10000 };
      const r = effortTransform(
        "high",
        stateWith("us.anthropic.claude-sonnet-4-5-20250929-v1:0", ["effort"]),
        out
      );
      expect(r).toBeUndefined();
      expect(out.thinking).toEqual({ type: "enabled", budget_tokens: 32768 });
      expect(out.max_tokens).toBe(32768 + 4096);
    });
  });

  describe("sampling-param rejection with Bedrock model IDs", () => {
    it("drops top_p / top_k for a Bedrock reject-list model", () => {
      expect(
        topPTransform(0.9, { model: "us.anthropic.claude-opus-4-8" })
      ).toBeUndefined();
      expect(
        dropIfModelRejectsSamplingParams(40, {
          model: "global.anthropic.claude-opus-5",
        })
      ).toBeUndefined();
    });

    it("keeps top_p for a non-reject Bedrock model", () => {
      expect(
        topPTransform(0.9, { model: "us.anthropic.claude-sonnet-4-6" })
      ).toBe(0.9);
    });

    it("matches dated Bedrock reject-list ids via prefix", () => {
      expect(
        dropIfModelRejectsSamplingParams(40, {
          model: "us.anthropic.claude-opus-4-8-20260528-v1:0",
        })
      ).toBeUndefined();
    });

    it("still exact-matches bare direct names (direct behavior preserved)", () => {
      expect(
        dropIfModelRejectsSamplingParams(40, { model: "claude-opus-4-8" })
      ).toBeUndefined();
      expect(
        dropIfModelRejectsSamplingParams(40, { model: "claude-sonnet-4-6" })
      ).toBe(40);
    });
  });

  // issue #716: effort enables thinking, and Anthropic forbids sampling params
  // while thinking is active (temperature/top_k unset, top_p unset or >= 0.95).
  // These models normally ALLOW sampling (not on the unconditional reject list),
  // so the drop must be gated on effort, not on the model alone.
  describe("sampling params dropped when effort enables thinking (issue #716)", () => {
    // Two adaptive 4.6 models + the three 4.5 legacy models: allow sampling
    // without effort, but effort turns on thinking.
    const thinkingModels = [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
    ];

    describe.each(thinkingModels)("%s with effort:'high'", (model) => {
      it("drops temperature and topK", () => {
        expect(
          dropIfModelRejectsSamplingParams(0.5, { model, effort: "high" })
        ).toBeUndefined();
        expect(
          dropIfModelRejectsSamplingParams(40, { model, effort: "high" })
        ).toBeUndefined();
      });

      it("drops topP below 0.95", () => {
        expect(topPTransform(0.9, { model, effort: "high" })).toBeUndefined();
        expect(topPTransform(0.94, { model, effort: "high" })).toBeUndefined();
      });

      it("keeps topP at or above 0.95", () => {
        expect(topPTransform(0.95, { model, effort: "high" })).toBe(0.95);
        expect(topPTransform(0.99, { model, effort: "high" })).toBe(0.99);
      });
    });

    it("keeps sampling params when no effort is set (thinking off)", () => {
      expect(
        dropIfModelRejectsSamplingParams(0.5, { model: "claude-sonnet-4-6" })
      ).toBe(0.5);
      expect(topPTransform(0.9, { model: "claude-sonnet-4-6" })).toBe(0.9);
    });

    it("keeps sampling params when effort targets a non-thinking model (Claude 3.x)", () => {
      const body = { model: "claude-3-5-sonnet-latest", effort: "high" };
      expect(dropIfModelRejectsSamplingParams(0.5, body)).toBe(0.5);
      expect(topPTransform(0.9, body)).toBe(0.9);
    });

    it("keeps sampling params when effort is an invalid value", () => {
      expect(
        dropIfModelRejectsSamplingParams(0.5, {
          model: "claude-sonnet-4-6",
          effort: "max",
        })
      ).toBe(0.5);
      expect(
        topPTransform(0.9, { model: "claude-sonnet-4-6", effort: "nonsense" })
      ).toBe(0.9);
      // Non-strings take the same path — a thinking-capable model, but the
      // effort is not one we honor, so thinking never turns on.
      expect(
        dropIfModelRejectsSamplingParams(0.5, { model: "claude-sonnet-4-6", effort: 7 })
      ).toBe(0.5);
      expect(
        topPTransform(0.9, { model: "claude-sonnet-4-6", effort: 7 })
      ).toBe(0.9);
    });

    it("reject-list models still drop topP unconditionally, even topP >= 0.95", () => {
      // opus-4-8 rejects sampling params regardless of thinking, so the >= 0.95
      // carve-out does not apply and 0.99 is still dropped.
      expect(
        topPTransform(0.99, { model: "claude-opus-4-8", effort: "high" })
      ).toBeUndefined();
      expect(topPTransform(0.99, { model: "claude-opus-4-8" })).toBeUndefined();
    });

    it("applies to Bedrock invoke IDs (canonicalized)", () => {
      expect(
        topPTransform(0.9, {
          model: "us.anthropic.claude-sonnet-4-6",
          effort: "high",
        })
      ).toBeUndefined();
      expect(
        topPTransform(0.96, {
          model: "us.anthropic.claude-sonnet-4-6",
          effort: "high",
        })
      ).toBe(0.96);
    });
  });

  // The options-based `useLlm("anthropic.chat.v1", {...})` entrypoint lets a
  // caller omit `model` — the raw config declares no model default, only the
  // shorthand keys get one via `withDefaultModel` — so every gate has to
  // tolerate an absent model rather than throw on it. These pin the fail-open
  // behavior: no model means no model-specific rewriting.
  describe("missing model on state/body", () => {
    it("effortTransform drops the effort and sets no thinking / max_tokens floor", () => {
      const out: Record<string, any> = { max_tokens: 10000 };
      expect(
        effortTransform("high", { [PROVIDED_OPTION_KEYS]: new Set(["effort"]) }, out)
      ).toBeUndefined();
      expect(out.thinking).toBeUndefined();
      expect(out.max_tokens).toBe(10000);
    });

    it("effortTransform tolerates a null/empty model the same way", () => {
      const out: Record<string, any> = {};
      expect(effortTransform("medium", { model: null }, out)).toBeUndefined();
      expect(effortTransform("medium", { model: "" }, out)).toBeUndefined();
      expect(out.thinking).toBeUndefined();
    });

    it("keeps sampling params when there is no model to gate on", () => {
      expect(dropIfModelRejectsSamplingParams(0.5, {})).toBe(0.5);
      expect(dropIfModelRejectsSamplingParams(0.5, { effort: "high" })).toBe(0.5);
      expect(topPTransform(0.5, {})).toBe(0.5);
      expect(topPTransform(0.5, { effort: "high" })).toBe(0.5);
    });
  });

  // `effort` arrives from user input and is only meaningful for the documented
  // values; anything else must be dropped rather than forwarded to the provider.
  // These paths are already covered by the suite — this pins the specific
  // malformed inputs (non-strings, `""`, wrong case) as contract, since no
  // existing case asserts them against `effortTransform`.
  describe("invalid effort values", () => {
    it("effortTransform drops non-string and unknown values", () => {
      const out: Record<string, any> = {};
      for (const bad of [undefined, null, 1, {}, [], true, "", "extreme", "HIGH"]) {
        expect(effortTransform(bad, { model: "claude-opus-5" }, out)).toBeUndefined();
      }
      expect(out.thinking).toBeUndefined();
    });
  });
});
