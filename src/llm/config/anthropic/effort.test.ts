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
      // opaque ARNs have no recognizable claude-... core -> returned unchanged
      [
        "arn:aws:bedrock:us-east-1:1:provisioned-model/x",
        "arn:aws:bedrock:us-east-1:1:provisioned-model/x",
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
});
