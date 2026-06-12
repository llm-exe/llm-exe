import { ollama } from "@/llm/config/ollama";
import { mapBody } from "@/llm/_utils.mapBody";
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

    it("declares sampling options", () => {
      expect(ollamaChatV1.options).toMatchObject({
        temperature: {},
        topP: {},
        maxTokens: {},
        stopSequences: {},
      });
    });

    it("maps sampling params into the Ollama options.* block", () => {
      expect(ollamaChatV1.mapBody.temperature).toEqual({
        key: "options.temperature",
      });
      expect(ollamaChatV1.mapBody.topP).toEqual({ key: "options.top_p" });
      expect(ollamaChatV1.mapBody.maxTokens).toEqual({
        key: "options.num_predict",
      });
      expect(ollamaChatV1.mapBody.stopSequences).toEqual({
        key: "options.stop",
      });
    });

    it("produces a body with nested options block when sampling params are set", () => {
      const body = mapBody(ollamaChatV1.mapBody, {
        model: "llama3.3",
        prompt: "hi",
        temperature: 0,
        topP: 0.9,
        maxTokens: 256,
        stopSequences: ["\n"],
      });
      expect(body).toMatchObject({
        model: "llama3.3",
        options: {
          temperature: 0,
          top_p: 0.9,
          num_predict: 256,
          stop: ["\n"],
        },
      });
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
