import {
  isModelKnownOpenAi,
  isModelKnownAnthropic,
  isModelKnownXai,
  isModelKnownBedrockAnthropic,
  guessProviderFromModel,
} from "./guessProviderFromModel";
import { LlmExeError } from "@/errors";

describe("Model Identification Functions", () => {
  describe("isModelKnownOpenAi", () => {
    const models = [
      "chatgpt-4o-latest",
      "gpt-4o-mini",
      "gpt-4o-audio-preview",
      "gpt-3.5-turbo",
      "o1",
      "o1-advanced",
      "o3-mini"
    ];

    for (const model of models) {
      it(`should return true for OpenAi model ${model}`, () => {
        expect(isModelKnownOpenAi({ model })).toBe(true);
      });
    }

    it("should return false for unknown models", () => {
      expect(isModelKnownOpenAi({ model: "random-model" })).toBe(false);
    });
  });

  describe("isModelKnownAnthropic", () => {
    const models = [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-20241022",
      "claude-3-5-haiku-latest",
      "claude-3-sonnet-20240229",
      "claude-3-opus-latest",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240229",
    ];

    for (const model of models) {
      it(`should return true for Anthropic model ${model}`, () => {
        expect(isModelKnownAnthropic({ model })).toBe(true);
      });
    }

    it("should return false for models not starting with 'claude-'", () => {
      expect(isModelKnownAnthropic({ model: "unknown-claude" })).toBe(false);
    });
  });

  describe("isModelKnownXai", () => {
    const models = ["grok-2", "grok-2-latest", "grok-3"];

    for (const model of models) {
      it(`should return true for x.ai model ${model}`, () => {
        expect(isModelKnownXai({ model })).toBe(true);
      });
    }

    it("should return false for models not containing 'grok-'", () => {
      expect(isModelKnownXai({ model: "whos-grok-2" })).toBe(false);
    });
  });

  describe("isModelKnownBedrockAnthropic", () => {
    const models = [
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
      "anthropic.claude-3-5-sonnet-20241022-v2:2",
      "anthropic.claude-3-5-haiku-20241022-v1:0",
      "anthropic.claude-3-haiku-20240307-v1:0",
    ];

    for (const model of models) {
      it(`should return true for Bedrock Anthropic model ${model}`, () => {
        expect(isModelKnownBedrockAnthropic({ model })).toBe(true);
      });
    }

    it("should return false for models not starting with 'anthropic.claude-'", () => {
      expect(isModelKnownBedrockAnthropic({ model: "anthropic-claude" })).toBe(
        false
      );
    });
  });

  describe("guessProviderFromModel", () => {
    it("should return 'openai' for OpenAI models", () => {
      expect(guessProviderFromModel({ model: "gpt-3.5" })).toBe("openai");
    });

    it("should return 'xai' for XAI models", () => {
      expect(guessProviderFromModel({ model: "grok-2" })).toBe("xai");
    });

    it("should return 'bedrock:anthropic' for Bedrock Anthropic models", () => {
      expect(guessProviderFromModel({ model: "anthropic.claude-v3" })).toBe(
        "bedrock:anthropic"
      );
    });

    it("should return 'anthropic' for Anthropic models", () => {
      expect(guessProviderFromModel({ model: "claude-simplified" })).toBe(
        "anthropic"
      );
    });

    it("should throw an error for unsupported models", () => {
      expect(() =>
        guessProviderFromModel({ model: "unsupported-model" })
      ).toThrow("Unsupported model");
    });

    it("throws LlmExeError with configuration.invalid_provider for unsupported models", () => {
      try {
        guessProviderFromModel({ model: "unsupported-model" });
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("configuration.invalid_provider");
        expect((e as LlmExeError).category).toBe("configuration");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("guessProviderFromModel");
        expect(ctx.model).toBe("unsupported-model");
        expect(Array.isArray(ctx.availableProviders)).toBe(true);
      }
    });
  });
});
