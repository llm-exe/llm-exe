import { deepseek } from "@/llm/config/deepseek";
import { Config } from "@/types";

describe("deepseek configuration", () => {
  const deepseekChatV1 = deepseek["deepseek.chat.v1"] as Config;
  const deepseekChat = deepseek["deepseek.chat"] as Config;

  describe("deepseek.chat.v1", () => {
    it("should have the correct key, provider, endpoint, and method", () => {
      expect(deepseekChatV1.key).toBe("deepseek.chat.v1");
      expect(deepseekChatV1.provider).toBe("deepseek.chat");
      expect(deepseekChatV1.endpoint).toBe(
        "https://api.deepseek.com/v1/chat/completions"
      );
      expect(deepseekChatV1.method).toBe("POST");
    });

    it("should have correct headers", () => {
      expect(deepseekChatV1.headers).toBe(
        `{"Authorization":"Bearer {{deepseekApiKey}}", "Content-Type": "application/json" }`
      );
    });

    it("should transform the prompt correctly", () => {
      const transformPrompt = deepseekChatV1.mapBody.prompt.transform as (
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
      const transformUseJson = deepseekChatV1.mapBody.useJson.transform as (
        v: any
      ) => any;
      expect(transformUseJson(true)).toBe("json_object");
      expect(transformUseJson(false)).toBe("text");
    });

    it("should treat the deepseek-flash and v4 families as reasoning models", () => {
      // isReasoningModel is only observable through the effort transform, which
      // forwards effort for reasoning models and drops it otherwise.
      const transformEffort = deepseekChatV1.mapBody.effort.transform as (
        v: any,
        s: any
      ) => any;
      expect(transformEffort("high", { model: "deepseek-flash" })).toBe("high");
      expect(transformEffort("low", { model: "deepseek-v4-flash" })).toBe("low");
      expect(transformEffort("max", { model: "deepseek-v4-pro" })).toBe("max");
      expect(
        transformEffort("high", { model: "deepseek-chat" })
      ).toBeUndefined();
    });
  });

  describe("deepseek.deepseek-chat", () => {
    it("should be based on deepseekChatV1 configuration", () => {
      expect(deepseekChat.endpoint).toEqual(deepseekChatV1.endpoint);
      expect(deepseekChat.method).toEqual(deepseekChatV1.method);
      expect(deepseekChat.headers).toEqual(deepseekChatV1.headers);
    });

    it("should keep its original default model, deepseek-chat", () => {
      // Deprecated shorthands keep the model id the caller asked for and warn;
      // they are never silently repointed to a different model.
      expect(deepseekChat.mapBody.model).toEqual({
        default: "deepseek-chat",
        key: "model",
      });
      expect(deepseekChat.options.model).toEqual({
        default: "deepseek-chat",
      });
    });

    it("should carry a deprecation payload pointing at deepseek.flash", () => {
      expect(deepseekChat.deprecated).toBeDefined();
      expect(deepseekChat.deprecated!.shorthand).toBe("deepseek.chat");
      expect(deepseekChat.deprecated!.message).toContain("deepseek.chat");
      expect(deepseekChat.deprecated!.message).toContain("deepseek.flash");
      // Must not route migrating users onto the retired legacy id.
      expect(deepseekChat.deprecated!.message).not.toContain(
        "deepseek.v4-flash"
      );
      // Verified live 2026-10-12: deepseek-chat still returns 200 (served as
      // deepseek-flash), so the announced 2026-07-24 shutdown did not happen.
      // The message must not state it as having occurred.
      expect(deepseekChat.deprecated!.message).not.toContain("2026-07-24");
      expect(deepseekChat.deprecated!.message).not.toMatch(/retired|will fail|no longer resolves/i);
      // deepseek-flash defaults to thinking mode (verified live 2026-10-15), so
      // it is not a drop-in replacement; the migration hint must say so.
      expect(deepseekChat.deprecated!.message).toMatch(/thinking mode/);
    });
  });

  describe("deepseek.flash", () => {
    const deepseekFlash = deepseek["deepseek.flash"] as Config;

    it("should be based on deepseekChatV1 configuration", () => {
      expect(deepseekFlash.endpoint).toEqual(deepseekChatV1.endpoint);
      expect(deepseekFlash.method).toEqual(deepseekChatV1.method);
      expect(deepseekFlash.headers).toEqual(deepseekChatV1.headers);
    });

    it("should override model in mapBody and options as deepseek-flash", () => {
      expect(deepseekFlash.mapBody.model).toEqual({
        default: "deepseek-flash",
        key: "model",
      });
      expect(deepseekFlash.options.model).toEqual({
        default: "deepseek-flash",
      });
    });

    it("should not be marked deprecated", () => {
      expect(deepseekFlash.deprecated).toBeUndefined();
    });
  });

  describe("deepseek.v4-flash", () => {
    const deepseekV4Flash = deepseek["deepseek.v4-flash"] as Config;

    it("should be based on deepseekChatV1 configuration", () => {
      expect(deepseekV4Flash.endpoint).toEqual(deepseekChatV1.endpoint);
      expect(deepseekV4Flash.method).toEqual(deepseekChatV1.method);
      expect(deepseekV4Flash.headers).toEqual(deepseekChatV1.headers);
    });

    it("should keep its original default model, deepseek-v4-flash", () => {
      // The id is a legacy alias DeepSeek still accepts, so the shorthand keeps
      // working; like every deprecated shorthand it warns rather than being
      // silently repointed to a different model.
      expect(deepseekV4Flash.mapBody.model).toEqual({
        default: "deepseek-v4-flash",
        key: "model",
      });
      expect(deepseekV4Flash.options.model).toEqual({
        default: "deepseek-v4-flash",
      });
    });

    it("should carry a deprecation payload pointing at deepseek.flash", () => {
      expect(deepseekV4Flash.deprecated).toBeDefined();
      expect(deepseekV4Flash.deprecated!.shorthand).toBe("deepseek.v4-flash");
      expect(deepseekV4Flash.deprecated!.message).toContain(
        "deepseek.v4-flash"
      );
      expect(deepseekV4Flash.deprecated!.message).toContain("deepseek.flash");
    });
  });

  describe("deepseek.v4-pro", () => {
    const deepseekV4Pro = deepseek["deepseek.v4-pro"] as Config;

    it("should be based on deepseekChatV1 configuration", () => {
      expect(deepseekV4Pro.endpoint).toEqual(deepseekChatV1.endpoint);
      expect(deepseekV4Pro.method).toEqual(deepseekChatV1.method);
      expect(deepseekV4Pro.headers).toEqual(deepseekChatV1.headers);
    });

    it("should override model in mapBody and options as deepseek-v4-pro", () => {
      expect(deepseekV4Pro.mapBody.model).toEqual({
        default: "deepseek-v4-pro",
        key: "model",
      });
      expect(deepseekV4Pro.options.model).toEqual({
        default: "deepseek-v4-pro",
      });
    });
  });
});
