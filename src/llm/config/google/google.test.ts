import { google } from "@/llm/config/google";
import { Config } from "@/types";

describe("google configuration", () => {
  const googleChatV1 = google["google.chat.v1"] as Config;
  const googleGemini2Flash = google["google.gemini-2.0-flash"] as Config;

  describe("google.chat.v1", () => {
    it("should have the correct key, provider, endpoint, and method", () => {
      expect(googleChatV1.key).toBe("google.chat.v1");
      expect(googleChatV1.provider).toBe("google.chat");
      expect(googleChatV1.endpoint).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent?key={{geminiApiKey}}"
      );
      expect(googleChatV1.method).toBe("POST");
    });

    it("should have correct headers", () => {
      expect(googleChatV1.headers).toBe(
        `{"Content-Type": "application/json" }`
      );
    });

    it("should transform the prompt correctly", () => {
      const transformPrompt = googleChatV1.mapBody.prompt.transform as (
        v: any
      ) => any;
      expect(transformPrompt("Hello")).toEqual([
        { role: "user", parts: [{ text: "Hello" }] },
      ]);
      expect(transformPrompt([{ role: "user", content: "Hello" }])).toEqual([
        { parts: [{ text: "Hello" }], role: "user" },
      ]);
    });
  });

  describe("google.chat.v1 effort transform", () => {
    const effortTransform = googleChatV1.mapBody.effort.transform as (
      v: any,
      s: any
    ) => any;

    it("should return 1024 for 'low' on a supported model", () => {
      expect(effortTransform("low", { model: "gemini-2.5-pro" })).toBe(1024);
    });

    it("should return 1024 for 'minimal' on a supported model", () => {
      expect(effortTransform("minimal", { model: "gemini-2.5-flash" })).toBe(
        1024
      );
    });

    it("should return 8192 for 'medium' on a supported model", () => {
      expect(effortTransform("medium", { model: "gemini-2.5-pro" })).toBe(
        8192
      );
    });

    it("should return 24576 for 'high' on a supported model", () => {
      expect(effortTransform("high", { model: "gemini-2.5-flash" })).toBe(
        24576
      );
    });

    it("should return undefined for unsupported model", () => {
      expect(effortTransform("high", { model: "gemini-2.0-flash" })).toBe(
        undefined
      );
    });

    it("should return undefined for non-string value", () => {
      expect(effortTransform(123, { model: "gemini-2.5-pro" })).toBe(
        undefined
      );
    });

    it("should return undefined for unsupported effort level", () => {
      expect(effortTransform("max", { model: "gemini-2.5-pro" })).toBe(
        undefined
      );
    });

    it("should work with gemini-2.5-flash-lite model", () => {
      expect(
        effortTransform("medium", { model: "gemini-2.5-flash-lite" })
      ).toBe(8192);
    });

    it("should return undefined for gemini-2.5-light (not a valid model ID)", () => {
      expect(
        effortTransform("medium", { model: "gemini-2.5-light" })
      ).toBeUndefined();
    });
  });

  describe("google.chat.v1 mapOptions", () => {
    it("should transform functionCall 'any' correctly", () => {
      const result = googleChatV1.mapOptions!.functionCall!("any", {});
      expect(result).toEqual({
        toolConfig: { functionCallingConfig: { mode: "any" } },
      });
    });

    it("should transform functionCall 'none' correctly", () => {
      const result = googleChatV1.mapOptions!.functionCall!("none", {});
      expect(result).toEqual({
        toolConfig: { functionCallingConfig: { mode: "none" } },
      });
    });

    it("should transform functionCall 'auto' correctly", () => {
      const result = googleChatV1.mapOptions!.functionCall!("auto", {});
      expect(result).toEqual({
        toolConfig: { functionCallingConfig: { mode: "auto" } },
      });
    });

    it("should transform functions to google format", () => {
      const functions = [
        {
          name: "search",
          description: "Search the web",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
          },
        },
      ];
      const result = googleChatV1.mapOptions!.functions!(functions, {});
      expect(result).toEqual({
        tools: [
          {
            functionDeclarations: [
              {
                name: "search",
                description: "Search the web",
                parameters: expect.objectContaining({
                  type: "object",
                  properties: { query: { type: "string" } },
                }),
              },
            ],
          },
        ],
      });
    });
  });

  describe("gemini-3.1-flash-lite", () => {
    const googleGemini31FlashLite = google[
      "google.gemini-3.1-flash-lite"
    ] as Config;

    it("should be based on googleChatV1 configuration", () => {
      expect(googleGemini31FlashLite.endpoint).toEqual(googleChatV1.endpoint);
      expect(googleGemini31FlashLite.method).toEqual(googleChatV1.method);
      expect(googleGemini31FlashLite.headers).toEqual(googleChatV1.headers);
    });

    it("should override model in mapBody and options as gemini-3.1-flash-lite", () => {
      expect(googleGemini31FlashLite.mapBody.model).toEqual({
        default: "gemini-3.1-flash-lite",
        key: "model",
      });
      expect(googleGemini31FlashLite.options.model).toEqual({
        default: "gemini-3.1-flash-lite",
      });
    });
  });

  describe("gemini-3.5-flash", () => {
    const googleGemini35Flash = google["google.gemini-3.5-flash"] as Config;

    it("should be based on googleChatV1 configuration", () => {
      expect(googleGemini35Flash.endpoint).toEqual(googleChatV1.endpoint);
      expect(googleGemini35Flash.method).toEqual(googleChatV1.method);
      expect(googleGemini35Flash.headers).toEqual(googleChatV1.headers);
    });

    it("should override model in mapBody and options as gemini-3.5-flash", () => {
      expect(googleGemini35Flash.mapBody.model).toEqual({
        default: "gemini-3.5-flash",
        key: "model",
      });
      expect(googleGemini35Flash.options.model).toEqual({
        default: "gemini-3.5-flash",
      });
    });
  });

  describe("gemini-2.0-flash", () => {
    it("should be based on googleChatV1 configuration", () => {
      expect(googleGemini2Flash.endpoint).toEqual(googleChatV1.endpoint);
      expect(googleGemini2Flash.method).toEqual(googleChatV1.method);
      expect(googleGemini2Flash.headers).toEqual(googleChatV1.headers);
    });

    it("should override model in mapBody and options as gemini-2.0-flash", () => {
      expect(googleGemini2Flash.mapBody.model).toEqual({
        default: "gemini-2.0-flash",
        key: "model",
      });
      expect(googleGemini2Flash.options.model).toEqual({
        default: "gemini-2.0-flash",
      });
    });
  });
});
