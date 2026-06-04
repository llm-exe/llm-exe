import { ollama } from "@/llm/config/ollama";
import { Config } from "@/types";

describe("ollama configuration", () => {
  const ollamaChatV1 = ollama["ollama.chat.v1"] as Config;

  describe("ollama.chat.v1", () => {
    it("should have the correct key, provider, endpoint, and method", () => {
      expect(ollamaChatV1.key).toBe("ollama.chat.v1");
      expect(ollamaChatV1.provider).toBe("ollama.chat");
      expect(ollamaChatV1.endpoint).toBe("http://localhost:11434/api/chat");
      expect(ollamaChatV1.method).toBe("POST");
    });

    it("should have correct headers", () => {
      expect(ollamaChatV1.headers).toBe(
        `{"Content-Type": "application/json" }`
      );
    });

    it("should transform the prompt correctly", () => {
      const transformPrompt = ollamaChatV1.mapBody.prompt.transform as (
        v: any
      ) => any;
      expect(transformPrompt("Hello")).toEqual([
        { role: "user", content: "Hello" },
      ]);
      expect(transformPrompt([{ role: "user", content: "Hello" }])).toEqual([
        { role: "user", content: "Hello" },
      ]);
    });
  });

  describe("shorthands", () => {
    it.each([
      ["ollama.deepseek-r1", "deepseek-r1"],
      ["ollama.llama3.3", "llama3.3"],
      ["ollama.llama3.2", "llama3.2"],
      ["ollama.llama3.1", "llama3.1"],
      ["ollama.qwq", "qwq"],
      ["ollama.gemma3", "gemma3"],
      ["ollama.mistral", "mistral"],
      ["ollama.qwen2.5", "qwen2.5"],
      ["ollama.qwen3", "qwen3"],
      ["ollama.qwen3.5", "qwen3.5"],
      ["ollama.gemma4", "gemma4"],
      ["ollama.gpt-oss", "gpt-oss"],
    ] as const)(
      "%s should resolve to %s",
      (shorthand, expectedModel) => {
        const cfg = ollama[shorthand];
        expect(cfg).toBeDefined();
        expect(cfg.options.model.default).toBe(expectedModel);
      }
    );
  });
});
