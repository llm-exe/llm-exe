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
  });

  describe("deepseek.deepseek-chat", () => {
    it("should be based on deepseekChatV1 configuration", () => {
      expect(deepseekChat.endpoint).toEqual(deepseekChatV1.endpoint);
      expect(deepseekChat.method).toEqual(deepseekChatV1.method);
      expect(deepseekChat.headers).toEqual(deepseekChatV1.headers);
    });

    it("should repoint the default model to deepseek-v4-flash", () => {
      expect(deepseekChat.mapBody.model).toEqual({
        default: "deepseek-v4-flash",
        key: "model",
      });
      expect(deepseekChat.options.model).toEqual({
        default: "deepseek-v4-flash",
      });
    });

    it("should carry a deprecation payload pointing at deepseek.v4-flash", () => {
      expect(deepseekChat.deprecated).toBeDefined();
      expect(deepseekChat.deprecated!.shorthand).toBe("deepseek.chat");
      expect(deepseekChat.deprecated!.message).toContain("deepseek.chat");
      expect(deepseekChat.deprecated!.message).toContain("2026-07-24");
      expect(deepseekChat.deprecated!.message).toContain("deepseek.v4-flash");
    });
  });

  describe("deepseek.v4-flash", () => {
    const deepseekV4Flash = deepseek["deepseek.v4-flash"] as Config;

    it("should be based on deepseekChatV1 configuration", () => {
      expect(deepseekV4Flash.endpoint).toEqual(deepseekChatV1.endpoint);
      expect(deepseekV4Flash.method).toEqual(deepseekChatV1.method);
      expect(deepseekV4Flash.headers).toEqual(deepseekChatV1.headers);
    });

    it("should override model in mapBody and options as deepseek-v4-flash", () => {
      expect(deepseekV4Flash.mapBody.model).toEqual({
        default: "deepseek-v4-flash",
        key: "model",
      });
      expect(deepseekV4Flash.options.model).toEqual({
        default: "deepseek-v4-flash",
      });
    });

    it("should not be marked deprecated", () => {
      expect(deepseekV4Flash.deprecated).toBeUndefined();
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
