import { BaseLlmOutput } from "@/llm/output/base";
import { GoogleGeminiResponse } from "@/interfaces";
import { OutputGoogleGeminiChat } from ".";

/**
 * Tests the TextPrompt class
 */
describe("llm-exe:output/OutputGoogleGeminiChat", () => {
  const mock: GoogleGeminiResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: '\n```json\n{\n "intent": "rent_car",\n "confidence": "95"\n}\n```',
            },
          ],
          role: "model",
        },
        finishReason: "STOP",
        avgLogprobs: -0.011675960742510282,
      },
    ],
    usageMetadata: {
      promptTokenCount: 351,
      candidatesTokenCount: 26,
      totalTokenCount: 377,
      promptTokensDetails: [
        {
          modality: "TEXT",
          tokenCount: 351,
        },
      ],
      candidatesTokensDetails: [
        {
          modality: "TEXT",
          tokenCount: 26,
        },
      ],
    },
    modelVersion: "gemini-2.0-flash",
    responseId: "12345-67890",
  };
  it("creates output with expected properties", () => {
    const output = OutputGoogleGeminiChat(mock as any);
    expect(output).toHaveProperty("id");
    expect(output).toHaveProperty("name");
    expect(output).toHaveProperty("created");
    expect(output).toHaveProperty("content");
    expect(output).toHaveProperty("usage");
  });
  it("creates output with correct values", () => {
    const output = OutputGoogleGeminiChat(mock as any);
    expect(typeof output.id).toEqual("string");
    expect(output.name).toEqual(mock.modelVersion);
    expect(typeof output.created).toEqual("number");
    expect(output.usage).toEqual({
      input_tokens: mock.usageMetadata.promptTokenCount,
      output_tokens: mock.usageMetadata.candidatesTokenCount,
      total_tokens: mock.usageMetadata.totalTokenCount,
    });
  });
  it("formats content correctly", () => {
    const output = OutputGoogleGeminiChat(mock as any);
    expect(output.content).toEqual([
      {
        type: "text",
        text: '\n```json\n{\n "intent": "rent_car",\n "confidence": "95"\n}\n```',
      },
    ]);
    expect(output.stopReason).toEqual("stop");
  });
  it("returns complete output structure", () => {
    const output = OutputGoogleGeminiChat(mock as any);
    expect(output).toEqual({
      content: [
        {
          text: '\n```json\n{\n "intent": "rent_car",\n "confidence": "95"\n}\n```',
          type: "text",
        },
      ],
      created: expect.any(Number),
      id: expect.any(String), // id is generated and not part of the mock
      name: expect.any(String),
      options: [],
      stopReason: "stop",
      usage: { input_tokens: 351, output_tokens: 26, total_tokens: 377 },
    });
  });

  it("uses default model name when modelVersion is undefined and no config", () => {
    const mockWithoutModel = {
      ...mock,
      modelVersion: undefined,
    };
    const output = OutputGoogleGeminiChat(mockWithoutModel as any);
    expect(output.name).toBe("gemini");
  });

  it("uses config default model when modelVersion is undefined", () => {
    const mockWithoutModel = {
      ...mock,
      modelVersion: undefined,
    };
    const config = {
      options: {
        model: {
          default: "gemini-from-config",
        },
      },
    };
    const output = OutputGoogleGeminiChat(
      mockWithoutModel as any,
      config as any,
    );
    expect(output.name).toBe("gemini-from-config");
  });

  it("handles missing candidates array", () => {
    const mockWithoutCandidates = {
      ...mock,
      candidates: undefined,
    };
    const output = OutputGoogleGeminiChat(mockWithoutCandidates as any);
    expect(output.content).toEqual([]);
    expect(output.options).toEqual([]);
    expect(output.stopReason).toBeUndefined();
  });

  it("handles empty candidates array", () => {
    const mockWithEmptyCandidates = {
      ...mock,
      candidates: [],
    };
    const output = OutputGoogleGeminiChat(mockWithEmptyCandidates as any);
    expect(output.content).toEqual([]);
    expect(output.options).toEqual([]);
    expect(output.stopReason).toBeUndefined();
  });

  describe("alternate candidates via BaseLlmOutput accessors", () => {
    const candidate = (text: string) => ({
      content: { parts: [{ text }], role: "model" },
      finishReason: "STOP",
      index: 0,
    });
    const threeCandidates = {
      ...mock,
      candidates: [candidate("A"), candidate("B"), candidate("C")],
    };

    it("getResultText(n) returns the nth candidate", () => {
      const out = BaseLlmOutput(OutputGoogleGeminiChat(threeCandidates as any));
      expect(out.getResultText()).toBe("A");
      expect(out.getResultText(1)).toBe("B");
      expect(out.getResultText(2)).toBe("C");
    });

    it("each option is a flat OutputResultContent[]", () => {
      const raw = OutputGoogleGeminiChat(threeCandidates as any);
      expect(raw.options).toEqual([
        [{ type: "text", text: "B" }],
        [{ type: "text", text: "C" }],
      ]);
    });

    it("normalizes function calls in an alternate candidate", () => {
      const raw = OutputGoogleGeminiChat({
        ...mock,
        candidates: [
          candidate("A"),
          {
            content: {
              parts: [{ functionCall: { name: "lookup", args: { q: "x" } } }],
              role: "model",
            },
            finishReason: "STOP",
            index: 1,
          },
        ],
      } as any);
      const [block] = BaseLlmOutput(raw).getResultContent(1);
      expect(block).toMatchObject({
        type: "function_use",
        name: "lookup",
        input: { q: "x" },
      });
      expect(typeof (block as any).functionId).toBe("string");
    });
  });
});
