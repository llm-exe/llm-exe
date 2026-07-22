import { KNOWN_ERROR_CODES } from "./knownCodes";
import { LlmExeError } from "./LlmExeError";

describe("KNOWN_ERROR_CODES", () => {
  it("registers embedding.unsupported_input", () => {
    expect(KNOWN_ERROR_CODES.has("embedding.unsupported_input")).toBe(true);
  });

  it("derives the embedding category for embedding.unsupported_input", () => {
    const error = new LlmExeError("nope", {
      code: "embedding.unsupported_input",
      context: {
        operation: "test",
        provider: "openai.embedding",
        inputKind: "multimodal",
      },
    });
    expect(error.code).toBe("embedding.unsupported_input");
    expect(error.category).toBe("embedding");
    expect((error.context as Record<string, unknown>).inputKind).toBe(
      "multimodal"
    );
  });
});
