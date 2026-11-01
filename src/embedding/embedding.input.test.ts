import { LlmExeError } from "@/errors";
import {
  assertTextOnlyEmbeddingInput,
  assertUniformEmbeddingInput,
  containsEmbeddingContentItem,
  isEmbeddingContentItem,
  isMultimodalEmbeddingInput,
} from "./embedding.input";

const imageItem = {
  content: [
    { type: "text" as const, text: "a red square" },
    {
      type: "image_url" as const,
      image_url: { url: "data:image/png;base64,AAAA" },
    },
  ],
};

const ctx = {
  operation: "test.transform",
  provider: "amazon:cohere.embedding",
  model: "cohere.embed-v4:0",
};

describe("isEmbeddingContentItem", () => {
  it("accepts an object with an array content property", () => {
    expect(isEmbeddingContentItem(imageItem)).toBe(true);
    expect(isEmbeddingContentItem({ content: [] })).toBe(true);
  });

  it("rejects strings, numbers, null, undefined and arrays", () => {
    expect(isEmbeddingContentItem("hello")).toBe(false);
    expect(isEmbeddingContentItem(42)).toBe(false);
    expect(isEmbeddingContentItem(null)).toBe(false);
    expect(isEmbeddingContentItem(undefined)).toBe(false);
    expect(isEmbeddingContentItem([imageItem])).toBe(false);
  });

  it("rejects an object whose content is not an array", () => {
    expect(isEmbeddingContentItem({ content: "not an array" })).toBe(false);
    expect(isEmbeddingContentItem({ text: "no content key" })).toBe(false);
  });
});

describe("isMultimodalEmbeddingInput", () => {
  it("is true only for a non-empty array of content items", () => {
    expect(isMultimodalEmbeddingInput([imageItem])).toBe(true);
    expect(isMultimodalEmbeddingInput([imageItem, imageItem])).toBe(true);
  });

  it("is false for text batches, empty arrays and non-arrays", () => {
    expect(isMultimodalEmbeddingInput("hello")).toBe(false);
    expect(isMultimodalEmbeddingInput(["a", "b"])).toBe(false);
    expect(isMultimodalEmbeddingInput([])).toBe(false);
    expect(isMultimodalEmbeddingInput(imageItem)).toBe(false);
    expect(isMultimodalEmbeddingInput(undefined)).toBe(false);
  });

  it("is false for a mixed array", () => {
    expect(isMultimodalEmbeddingInput(["a", imageItem])).toBe(false);
  });

  it("is false for OpenAI pre-tokenized input", () => {
    expect(
      isMultimodalEmbeddingInput([
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toBe(false);
  });
});

describe("containsEmbeddingContentItem", () => {
  it("detects a bare item and an item nested in an array", () => {
    expect(containsEmbeddingContentItem(imageItem)).toBe(true);
    expect(containsEmbeddingContentItem([imageItem])).toBe(true);
    expect(containsEmbeddingContentItem(["a", imageItem])).toBe(true);
  });

  it("is false for plain text and pre-tokenized input", () => {
    expect(containsEmbeddingContentItem("hello")).toBe(false);
    expect(containsEmbeddingContentItem(["a", "b"])).toBe(false);
    expect(containsEmbeddingContentItem([[1, 2, 3]])).toBe(false);
    expect(containsEmbeddingContentItem(undefined)).toBe(false);
  });
});

describe("assertUniformEmbeddingInput", () => {
  it("allows an all-text and an all-multimodal batch", () => {
    expect(() => assertUniformEmbeddingInput(["a", "b"], ctx)).not.toThrow();
    expect(() =>
      assertUniformEmbeddingInput([imageItem, imageItem], ctx),
    ).not.toThrow();
    expect(() => assertUniformEmbeddingInput("a", ctx)).not.toThrow();
    expect(() => assertUniformEmbeddingInput([], ctx)).not.toThrow();
    expect(() => assertUniformEmbeddingInput(undefined, ctx)).not.toThrow();
  });

  it("throws embedding.unsupported_input on a mixed batch", () => {
    try {
      assertUniformEmbeddingInput(["a", imageItem, "c"], ctx);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("embedding.unsupported_input");
      expect((e as LlmExeError).category).toBe("embedding");
      expect((e as Error).message).toMatch(
        /mixes multimodal content items with plain values \(1 of 3/,
      );
      const c = (e as LlmExeError).context as Record<string, unknown>;
      expect(c.operation).toBe("test.transform");
      expect(c.provider).toBe("amazon:cohere.embedding");
      expect(c.model).toBe("cohere.embed-v4:0");
      expect(c.inputKind).toBe("mixed");
    }
  });
});

describe("assertTextOnlyEmbeddingInput", () => {
  const textOnlyCtx = {
    operation: "test.transform",
    provider: "openai.embedding",
    model: "text-embedding-3-small",
  };

  it("allows strings, string arrays and pre-tokenized input", () => {
    expect(() =>
      assertTextOnlyEmbeddingInput("hello", textOnlyCtx),
    ).not.toThrow();
    expect(() =>
      assertTextOnlyEmbeddingInput(["a", "b"], textOnlyCtx),
    ).not.toThrow();
    expect(() =>
      assertTextOnlyEmbeddingInput([[1, 2, 3]], textOnlyCtx),
    ).not.toThrow();
    expect(() =>
      assertTextOnlyEmbeddingInput(undefined, textOnlyCtx),
    ).not.toThrow();
  });

  it("throws embedding.unsupported_input for multimodal input", () => {
    try {
      assertTextOnlyEmbeddingInput([imageItem], textOnlyCtx);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("embedding.unsupported_input");
      expect((e as Error).message).toMatch(
        /Provider "openai\.embedding" does not accept multimodal embedding input/,
      );
      const c = (e as LlmExeError).context as Record<string, unknown>;
      expect(c.provider).toBe("openai.embedding");
      expect(c.model).toBe("text-embedding-3-small");
      expect(c.inputKind).toBe("multimodal");
      expect(c.resolution).toMatch(/amazon:cohere\.embedding\.v1/);
    }
  });

  it("throws for a bare content item, not just an array of them", () => {
    expect(() => assertTextOnlyEmbeddingInput(imageItem, textOnlyCtx)).toThrow(
      /does not accept multimodal embedding input/,
    );
  });
});
