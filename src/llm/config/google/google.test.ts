import { google } from "@/llm/config/google";
import { mapBody } from "@/llm/_utils.mapBody";
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

  describe("google.chat.v1 sampling options", () => {
    it("declares sampling options", () => {
      expect(googleChatV1.options).toMatchObject({
        temperature: {},
        topP: {},
        maxTokens: {},
        stopSequences: {},
      });
    });

    it("maps sampling params into generationConfig.*", () => {
      expect(googleChatV1.mapBody.temperature).toEqual({
        key: "generationConfig.temperature",
      });
      expect(googleChatV1.mapBody.topP).toEqual({
        key: "generationConfig.topP",
      });
      expect(googleChatV1.mapBody.maxTokens).toEqual({
        key: "generationConfig.maxOutputTokens",
      });
      expect(googleChatV1.mapBody.stopSequences).toEqual({
        key: "generationConfig.stopSequences",
      });
    });

    it("produces a body with generationConfig when sampling params are set", () => {
      // Gemini puts the model in the URL path, not the body — only generationConfig is asserted.
      const body = mapBody(googleChatV1.mapBody, {
        model: "gemini-2.0-flash",
        prompt: "hi",
        temperature: 0,
        topP: 0.9,
        maxTokens: 256,
        stopSequences: ["\n"],
      });
      expect(body).toMatchObject({
        generationConfig: {
          temperature: 0,
          topP: 0.9,
          maxOutputTokens: 256,
          stopSequences: ["\n"],
        },
      });
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

  describe("gemini-3.5-flash-lite", () => {
    const googleGemini35FlashLite = google[
      "google.gemini-3.5-flash-lite"
    ] as Config;

    it("should be based on googleChatV1 configuration", () => {
      expect(googleGemini35FlashLite.endpoint).toEqual(googleChatV1.endpoint);
      expect(googleGemini35FlashLite.method).toEqual(googleChatV1.method);
      expect(googleGemini35FlashLite.headers).toEqual(googleChatV1.headers);
    });

    it("should override model in mapBody and options as gemini-3.5-flash-lite", () => {
      expect(googleGemini35FlashLite.mapBody.model).toEqual({
        default: "gemini-3.5-flash-lite",
        key: "model",
      });
      expect(googleGemini35FlashLite.options.model).toEqual({
        default: "gemini-3.5-flash-lite",
      });
    });
  });

  describe("gemini-3.6-flash", () => {
    const googleGemini36Flash = google["google.gemini-3.6-flash"] as Config;

    it("should be based on googleChatV1 configuration", () => {
      expect(googleGemini36Flash.endpoint).toEqual(googleChatV1.endpoint);
      expect(googleGemini36Flash.method).toEqual(googleChatV1.method);
      expect(googleGemini36Flash.headers).toEqual(googleChatV1.headers);
    });

    it("should override model in mapBody and options as gemini-3.6-flash", () => {
      expect(googleGemini36Flash.mapBody.model).toEqual({
        default: "gemini-3.6-flash",
        key: "model",
      });
      expect(googleGemini36Flash.options.model).toEqual({
        default: "gemini-3.6-flash",
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

  describe("gemini-2.5 shorthands", () => {
    it.each([
      ["google.gemini-2.5-flash", "gemini-2.5-flash"],
      ["google.gemini-2.5-flash-lite", "gemini-2.5-flash-lite"],
      ["google.gemini-2.5-pro", "gemini-2.5-pro"],
    ] as const)("%s should resolve to %s", (shorthand, expectedModel) => {
      const config = google[shorthand] as Config;
      expect(config).toBeDefined();
      expect(config.options.model).toEqual({ default: expectedModel });
      expect(config.mapBody.model).toEqual({
        default: expectedModel,
        key: "model",
      });
    });

    it("does not warn on gemini-2.5-flash, which is still served", () => {
      // Verified live 2026-08-27: 200 OK. The "earliest possible" date in
      // Google's deprecation table was not a commitment, and warning on a live
      // model teaches users to ignore warnings. See issue #762.
      expect(
        (google["google.gemini-2.5-flash"] as Config).deprecated
      ).toBeUndefined();
    });

    it.each([
      ["google.gemini-2.5-flash-lite", "google.gemini-3.5-flash-lite"],
      ["google.gemini-2.5-pro", "google.gemini-3.5-flash"],
    ] as const)(
      "%s still warns, because it is no longer available to new users",
      (shorthand, migrateTo) => {
        // Verified live 2026-08-27: both return 404 "no longer available to
        // new users". Only the fabricated shutdown dates were wrong; the
        // warning itself is load-bearing, so it stays. See issue #762.
        const deprecated = (google[shorthand] as Config).deprecated;
        expect(deprecated).toBeDefined();
        expect(deprecated!.shorthand).toBe(shorthand);
        expect(deprecated!.message).toContain("no longer available to new users");
        expect(deprecated!.message).toContain(migrateTo);
        // the fabricated dates must not come back
        expect(deprecated!.message).not.toContain("2026-06-17");
        expect(deprecated!.message).not.toContain("2026-07-22");
      }
    );

    it("should be based on googleChatV1 configuration", () => {
      const config = google["google.gemini-2.5-pro"] as Config;
      expect(config.endpoint).toEqual(googleChatV1.endpoint);
      expect(config.method).toEqual(googleChatV1.method);
      expect(config.headers).toEqual(googleChatV1.headers);
    });
  });

  describe("retired shorthands", () => {
    it.each([
      [
        "google.gemini-2.0-flash",
        "gemini-2.0-flash",
        "google.gemini-3.5-flash",
      ],
      [
        "google.gemini-2.0-flash-lite",
        "gemini-2.0-flash-lite",
        "google.gemini-3.1-flash-lite",
      ],
      ["google.gemini-1.5-pro", "gemini-1.5-pro", "google.gemini-3.5-flash"],
    ] as const)(
      "%s should still resolve to %s but be marked deprecated",
      (shorthand, expectedModel, migrateTo) => {
        const config = google[shorthand] as Config;
        expect(config).toBeDefined();
        expect(config.options.model).toEqual({ default: expectedModel });
        expect(config.mapBody.model).toEqual({
          default: expectedModel,
          key: "model",
        });
        expect(config.deprecated?.shorthand).toEqual(shorthand);
        expect(config.deprecated?.message).toContain(migrateTo);
      }
    );
  });

  describe("deprecation messages", () => {
    const deprecated = Object.values(google as Record<string, Config>).filter(
      (config) => config.deprecated
    );

    it("only cites dates for shutdowns Google has already carried out", () => {
      expect(deprecated.length).toBeGreaterThan(0);
      for (const config of deprecated) {
        const message = config.deprecated!.message;
        // Google's deprecation table publishes "earliest possible" shutdown
        // dates, not commitments. Never promise a future shutdown date on
        // their behalf — a date in a message means it already happened.
        expect(message).not.toMatch(/will shut down on/);
        if (/\d{4}-\d{2}-\d{2}/.test(message)) {
          expect(message).toMatch(
            /was shut down by Google on \d{4}-\d{2}-\d{2}/
          );
        }
      }
    });
  });

  describe("image content through mapBody", () => {
    it("converts image_url blocks into inlineData parts in the request body", () => {
      const body = mapBody(googleChatV1.mapBody, {
        model: "gemini-2.0-flash",
        prompt: [
          { role: "user", content: "intro" },
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this image?" },
              {
                type: "image_url",
                image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
              },
            ],
          },
        ],
      });

      expect(body.contents).toEqual([
        {
          role: "user",
          parts: [
            { text: "intro" },
            { text: "What is in this image?" },
            { inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } },
          ],
        },
      ]);
    });
  });
});
