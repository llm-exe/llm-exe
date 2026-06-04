import { xai } from "@/llm/config/x";
import { Config } from "@/types";

describe("openai configuration", () => {
  const xAiChatV1 = xai["xai.chat.v1"] as Config;

  describe("xai.chat.v1", () => {
    it("should have the correct key, provider, endpoint, and method", () => {
      expect(xAiChatV1.key).toBe("xai.chat.v1");
      expect(xAiChatV1.provider).toBe("xai.chat");
      expect(xAiChatV1.endpoint).toBe("https://api.x.ai/v1/chat/completions");
      expect(xAiChatV1.method).toBe("POST");
    });

    it("should have correct headers", () => {
      expect(xAiChatV1.headers).toBe(
        `{"Authorization":"Bearer {{xAiApiKey}}", "Content-Type": "application/json" }`
      );
    });

    it("should transform the prompt correctly", () => {
      const transformPrompt = xAiChatV1.mapBody.prompt.transform as (
        v: any
      ) => any;
      expect(transformPrompt("Hello")).toEqual([
        { role: "user", content: "Hello" },
      ]);
      expect(transformPrompt([{ role: "user", content: "Hello" }])).toEqual([
        { role: "user", content: "Hello" },
      ]);
    });

    it("should transform useJson correctly", () => {
      const transformUseJson = xAiChatV1.mapBody.useJson.transform as (
        v: any
      ) => any;
      expect(transformUseJson(true)).toBe("json_object");
      expect(transformUseJson(false)).toBe("text");
    });
  });

  describe("xai.grok-4-1-fast", () => {
    const config = xai["xai.grok-4-1-fast"] as Config;

    it("should have the correct default model", () => {
      expect(config.options.model.default).toBe("grok-4-1-fast-non-reasoning");
    });

    it("should have the correct key, provider, endpoint, and method", () => {
      expect(config.key).toBe("xai.chat.v1");
      expect(config.provider).toBe("xai.chat");
      expect(config.endpoint).toBe("https://api.x.ai/v1/chat/completions");
      expect(config.method).toBe("POST");
    });
  });

  describe("xai.grok-4.3", () => {
    const config = xai["xai.grok-4.3"] as Config;

    it("should have the correct default model", () => {
      expect(config.options.model.default).toBe("grok-4.3");
    });

    it("should have the correct key, provider, endpoint, and method", () => {
      expect(config.key).toBe("xai.chat.v1");
      expect(config.provider).toBe("xai.chat");
      expect(config.endpoint).toBe("https://api.x.ai/v1/chat/completions");
      expect(config.method).toBe("POST");
    });
  });

  describe("all shorthands resolve to expected default model", () => {
    it.each([
      ["xai.grok-2", "grok-2-latest"],
      ["xai.grok-3", "grok-3"],
      ["xai.grok-3-mini", "grok-3-mini"],
      ["xai.grok-4", "grok-4"],
      ["xai.grok-4-fast", "grok-4-fast-non-reasoning"],
      ["xai.grok-4-1-fast", "grok-4-1-fast-non-reasoning"],
      ["xai.grok-4.3", "grok-4.3"],
    ] as const)(
      "%s should resolve to %s and share base config",
      (shorthand, expectedModel) => {
        const cfg = xai[shorthand] as Config;
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
        expect(cfg.mapBody.model).toEqual({
          default: expectedModel,
          key: "model",
        });
        // Inherits base provider/endpoint/method/headers
        expect(cfg.key).toBe(xAiChatV1.key);
        expect(cfg.provider).toBe(xAiChatV1.provider);
        expect(cfg.endpoint).toBe(xAiChatV1.endpoint);
        expect(cfg.method).toBe(xAiChatV1.method);
        expect(cfg.headers).toBe(xAiChatV1.headers);
      }
    );
  });

  describe("effort transform", () => {
    const transform = xai["xai.chat.v1"].mapBody.effort.transform as (
      v: any,
      s: any
    ) => any;

    it("drops effort for non-reasoning xAI models", () => {
      for (const model of [
        "grok-2-latest",
        "grok-3",
        "grok-3-mini",
        "grok-4",
        "grok-4-fast-non-reasoning",
        "grok-4-1-fast-non-reasoning",
      ]) {
        expect(transform("low", { model })).toBeUndefined();
        expect(transform("high", { model })).toBeUndefined();
      }
    });

    it("passes through valid effort values for grok-4.3", () => {
      for (const value of ["low", "medium", "high"]) {
        expect(transform(value, { model: "grok-4.3" })).toBe(value);
      }
    });

    it("passes through minimal effort for grok-4.3", () => {
      expect(transform("minimal", { model: "grok-4.3" })).toBe("minimal");
    });

    it("drops invalid effort values for grok-4.3", () => {
      expect(transform("none", { model: "grok-4.3" })).toBeUndefined();
      expect(transform("xhigh", { model: "grok-4.3" })).toBeUndefined();
      expect(transform(123, { model: "grok-4.3" })).toBeUndefined();
    });
  });
});
