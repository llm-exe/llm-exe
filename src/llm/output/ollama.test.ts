// import { OllamaResponse } from "@/interfaces";
import { OutputOllamaChat } from "@/llm/output/ollama";

/**
 * Tests the TextPrompt class
 */
describe("llm-exe:output/OutputOllamaChat", () => {
    const model = `deepseek-r1`;
    const created_at = "2025-03-08T16:58:04.349672Z"
  const mock = `
{"model":"${model}","created_at":"2025-03-08T16:58:03.782254Z","message":{"role":"assistant","content":"\\u003cthink\\u003e"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:03.821413Z","message":{"role":"assistant","content":"\\n\\n"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:03.861355Z","message":{"role":"assistant","content":"\\u003c/think\\u003e"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:03.900327Z","message":{"role":"assistant","content":"\\n\\n"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:03.93905Z","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:03.977765Z","message":{"role":"assistant","content":"!"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.0163Z","message":{"role":"assistant","content":" How"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.05436Z","message":{"role":"assistant","content":" can"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.094752Z","message":{"role":"assistant","content":" I"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.132316Z","message":{"role":"assistant","content":" assist"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.168753Z","message":{"role":"assistant","content":" you"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.204911Z","message":{"role":"assistant","content":" today"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.241527Z","message":{"role":"assistant","content":"?"},"done":false}
{"model":"${model}","created_at":"2025-03-08T16:58:04.313535Z","message":{"role":"assistant","content":" 😊"},"done":false}
{"model":"${model}","created_at":"${created_at}","message":{"role":"assistant","content":""},"done_reason":"stop","done":true,"total_duration":1014197584,"load_duration":25932875,"prompt_eval_count":5,"prompt_eval_duration":419000000,"eval_count":16,"eval_duration":568000000}`;
  
it("creates output with expected properties", () => {
    const output = OutputOllamaChat(mock);
    expect(output).toHaveProperty("id");
    expect(output).toHaveProperty("name");
    expect(output).toHaveProperty("created");
    expect(output).toHaveProperty("content");
    expect(output).toHaveProperty("usage");
  });
  it("creates output with correct values", () => {
    const output = OutputOllamaChat(mock as any);
    expect(output.id).toEqual(`${model}.${created_at}`);
    expect(output.name).toEqual(model);
    expect(output.created).toEqual(new Date(created_at).getTime());
    expect(output.usage).toEqual({
      input_tokens: 5,
      output_tokens: 16,
      total_tokens: 21,
    });
  });

  it("formats content correctly", () => {
    const output = OutputOllamaChat(mock as any);
    expect(output.content).toEqual([
      {
        type: "text",
        text: "<think>\n\n</think>\n\nHello! How can I assist you today? 😊",
      },
    ]);
    expect(output.stopReason).toEqual("stop");
  });

  it("uses default model name when model is undefined and no config", () => {
    const mockWithoutModel = `
{"created_at":"${created_at}","message":{"role":"assistant","content":"Hello"},"done":false}
{"created_at":"${created_at}","message":{"role":"assistant","content":""},"done_reason":"stop","done":true}`;
    const output = OutputOllamaChat(mockWithoutModel);
    expect(output.name).toBe("ollama.unknown");
  });

  it("uses config default model when model is undefined", () => {
    const mockWithoutModel = `
{"created_at":"${created_at}","message":{"role":"assistant","content":"Hello"},"done":false}
{"created_at":"${created_at}","message":{"role":"assistant","content":""},"done_reason":"stop","done":true}`;
    const config = {
      options: {
        model: {
          default: "ollama-from-config",
        },
      },
    };
    const output = OutputOllamaChat(mockWithoutModel, config as any);
    expect(output.name).toBe("ollama-from-config");
  });

  it("uses model from response when available", () => {
    const mockWithModel = `
{"model":"llama2","created_at":"${created_at}","message":{"role":"assistant","content":"Hi"},"done":false}
{"model":"llama2","created_at":"${created_at}","message":{"role":"assistant","content":""},"done_reason":"stop","done":true}`;
    const config = {
      options: {
        model: {
          default: "ollama-from-config",
        },
      },
    };
    const output = OutputOllamaChat(mockWithModel, config as any);
    expect(output.name).toBe("llama2");
  });

  it("handles missing done_reason", () => {
    const mockWithoutDoneReason = `
{"model":"${model}","created_at":"${created_at}","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"${model}","created_at":"${created_at}","message":{"role":"assistant","content":""},"done":true}`;
    const output = OutputOllamaChat(mockWithoutDoneReason);
    expect(output.stopReason).toBe("stop");
  });

  describe("malformed and edge-case responses", () => {
    it("throws llm.invalid_jsonl_response for a non-JSON line", () => {
      const bad = `{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":"Hi"},"done":false}
not json
{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":""},"done":true}`;
      expect(() => OutputOllamaChat(bad)).toThrow(
        expect.objectContaining({ code: "llm.invalid_jsonl_response" })
      );
    });

    it("throws llm.invalid_jsonl_response for an empty response body", () => {
      expect(() => OutputOllamaChat("   \n  \n")).toThrow(
        expect.objectContaining({ code: "llm.invalid_jsonl_response" })
      );
    });

    it("throws when the stream never reaches a done line (truncated stream)", () => {
      const truncated = `{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":"Hel"},"done":false}
{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":"lo"},"done":false}`;
      expect(() => OutputOllamaChat(truncated)).toThrow(
        "No line found where done = true."
      );
    });

    it("handles a single non-streamed response line", () => {
      const single = `{"model":"llama3","created_at":"${created_at}","message":{"role":"assistant","content":"Full answer"},"done_reason":"stop","done":true}`;
      const output = OutputOllamaChat(single);
      expect(output.content).toEqual([{ type: "text", text: "Full answer" }]);
      expect(output.id).toBe(`llama3.${created_at}`);
      expect(output.stopReason).toBe("stop");
    });

    it("reassembles chunks in created_at order even when lines arrive out of order", () => {
      const shuffled = `{"model":"m","created_at":"2025-03-08T16:58:03.900Z","message":{"role":"assistant","content":" world"},"done":false}
{"model":"m","created_at":"2025-03-08T16:58:04.000Z","message":{"role":"assistant","content":""},"done_reason":"stop","done":true}
{"model":"m","created_at":"2025-03-08T16:58:03.800Z","message":{"role":"assistant","content":"Hello"},"done":false}`;
      const output = OutputOllamaChat(shuffled);
      expect(output.content).toEqual([{ type: "text", text: "Hello world" }]);
      expect(output.id).toBe("m.2025-03-08T16:58:04.000Z");
    });

    it("tolerates CRLF line endings and blank lines between chunks", () => {
      const crlf = [
        `{"model":"m","created_at":"2025-03-08T16:58:03.800Z","message":{"role":"assistant","content":"A"},"done":false}`,
        ``,
        `{"model":"m","created_at":"2025-03-08T16:58:03.900Z","message":{"role":"assistant","content":"B"},"done":false}`,
        `{"model":"m","created_at":"2025-03-08T16:58:04.000Z","message":{"role":"assistant","content":""},"done":true}`,
      ].join("\r\n");
      const output = OutputOllamaChat(crlf);
      expect(output.content).toEqual([{ type: "text", text: "AB" }]);
    });

    it("treats chunks with a missing message or null content as empty text", () => {
      const sparse = `{"model":"m","created_at":"2025-03-08T16:58:03.800Z","message":{"role":"assistant","content":"A"},"done":false}
{"model":"m","created_at":"2025-03-08T16:58:03.850Z","done":false}
{"model":"m","created_at":"2025-03-08T16:58:03.900Z","message":{"role":"assistant","content":null},"done":false}
{"model":"m","created_at":"2025-03-08T16:58:04.000Z","message":{"role":"assistant","content":"B"},"done":true}`;
      const output = OutputOllamaChat(sparse);
      expect(output.content).toEqual([{ type: "text", text: "AB" }]);
    });

    it("returns an empty text block when the model produced no content", () => {
      const empty = `{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":""},"done_reason":"stop","done":true}`;
      const output = OutputOllamaChat(empty);
      expect(output.content).toEqual([{ type: "text", text: "" }]);
    });

    it("passes through non-stop done_reason values (e.g. length)", () => {
      const truncatedByLength = `{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":"cut"},"done_reason":"length","done":true}`;
      expect(OutputOllamaChat(truncatedByLength).stopReason).toBe("length");
    });

    it("decodes literal \\u003c / \\u003e escape sequences left in content", () => {
      // JSON "\\u003c" parses to the literal 6-char string "\u003c"
      const escaped = `{"model":"m","created_at":"${created_at}","message":{"role":"assistant","content":"\\\\u003cb\\\\u003e"},"done":true}`;
      const output = OutputOllamaChat(escaped);
      expect(output.content).toEqual([{ type: "text", text: "<b>" }]);
    });

    it.each([undefined, "not a timestamp"])(
      "uses the current time when created_at is %s",
      (timestamp) => {
        const now = Date.parse("2026-01-02T03:04:05.000Z");
        const clock = jest.spyOn(Date, "now").mockReturnValue(now);
        try {
          const output = OutputOllamaChat(JSON.stringify({
            model: "m",
            created_at: timestamp,
            message: { role: "assistant", content: "x" },
            done: true,
          }));
          expect(output.created).toBe(now);
          expect(output.id).toBe("m.2026-01-02T03:04:05.000Z");
        } finally {
          clock.mockRestore();
        }
      }
    );

    it.each([
      [{ eval_count: 16 }, 0, 16],
      [{ prompt_eval_count: 5 }, 5, 0],
      [{}, 0, 0],
    ] as const)("defaults only the missing token counts in %j", (counts, input, generated) => {
      const output = OutputOllamaChat(JSON.stringify({ done: true, ...counts }));
      expect(output.usage).toEqual({
        input_tokens: input,
        output_tokens: generated,
        total_tokens: input + generated,
      });
      expect(output.options).toEqual([]);
    });
  });
});
