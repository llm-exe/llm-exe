import { CohereBedrockEmbedding } from "@/embedding/output/CohereBedrockEmbedding";
import { BaseEmbeddingOutput } from "@/embedding/output/BaseEmbeddingOutput";
import { CohereBedrockEmbeddingApiResponseOutput } from "@/types";
import { deepClone } from "@/utils/modules/deepClone";
import { LlmExeError } from "@/errors";

jest.mock("@/utils/modules/deepClone", () => ({
  deepClone: jest.fn(),
}));

jest.mock("@/embedding/output/BaseEmbeddingOutput", () => ({
  BaseEmbeddingOutput: jest.fn(),
}));

describe("CohereBedrockEmbedding", () => {
  const deepCloneMock = deepClone as jest.Mock;
  const BaseEmbeddingOutputMock = BaseEmbeddingOutput as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses provided model and passes embeddings through", () => {
    const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
      id: "abc-123",
      response_type: "embeddings_floats",
      embeddings: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ],
      texts: ["hello", "world"],
    };

    const mockConfig = { model: "cohere.embed-english-v3" };

    deepCloneMock.mockReturnValueOnce(mockResult);

    CohereBedrockEmbedding(mockResult, mockConfig);

    expect(deepCloneMock).toHaveBeenCalledWith(mockResult);
    expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith({
      id: "abc-123",
      model: "cohere.embed-english-v3",
      created: expect.any(Number),
      usage: {
        output_tokens: 0,
        input_tokens: 0,
        total_tokens: 0,
      },
      embedding: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ],
    });
  });

  it("falls back to 'cohere.unknown' when no model is provided", () => {
    const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
      embeddings: [[0.7, 0.8]],
    };

    deepCloneMock.mockReturnValueOnce(mockResult);

    CohereBedrockEmbedding(mockResult, {});

    expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "cohere.unknown",
        embedding: [[0.7, 0.8]],
      })
    );
  });

  it("resolves Embed v4 embeddings keyed by type (float)", () => {
    const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
      id: "v4-123",
      response_type: "embeddings_by_type",
      embeddings: {
        float: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      },
      texts: ["hello", "world"],
    };

    deepCloneMock.mockReturnValueOnce(mockResult);

    CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" });

    expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "cohere.embed-v4:0",
        embedding: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      })
    );
  });

  it("reads Bedrock token counts from response headers", () => {
    const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
      response_type: "embeddings_by_type",
      embeddings: { float: [[0.1, 0.2]] },
    };
    deepCloneMock.mockReturnValueOnce({ ...mockResult });

    CohereBedrockEmbedding(
      mockResult,
      { model: "cohere.embed-v4:0" },
      { "x-amzn-bedrock-input-token-count": "9" }
    );

    expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: { input_tokens: 9, output_tokens: 0, total_tokens: 9 },
      })
    );
  });

  it("falls back to zero usage when no headers are provided", () => {
    const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
      embeddings: [[0.1]],
    };
    deepCloneMock.mockReturnValueOnce(mockResult);

    CohereBedrockEmbedding(mockResult, {});

    expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      })
    );
  });

  it("throws when v4 response contains only a type we never request", () => {
    const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
      response_type: "embeddings_by_type",
      embeddings: {
        int8: [[1, 2, 3]],
      },
    };

    deepCloneMock.mockReturnValueOnce(mockResult);

    expect(() =>
      CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" })
    ).toThrow(/Expected float embeddings.*received object with keys: \[int8\]/);
    expect(BaseEmbeddingOutputMock).not.toHaveBeenCalled();
  });

  it("throws when response has no embeddings field", () => {
    const mockResult = {} as CohereBedrockEmbeddingApiResponseOutput;

    deepCloneMock.mockReturnValueOnce(mockResult);

    expect(() =>
      CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" })
    ).toThrow(/Unexpected embeddings shape.*cohere\.embed-v4:0.*received: undefined/);
    expect(BaseEmbeddingOutputMock).not.toHaveBeenCalled();
  });

  it("throws with 'received: null' when embeddings is explicitly null", () => {
    const mockResult = {
      embeddings: null,
    } as unknown as CohereBedrockEmbeddingApiResponseOutput;

    deepCloneMock.mockReturnValueOnce(mockResult);

    expect(() =>
      CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" })
    ).toThrow(/Unexpected embeddings shape.*received: null/);
    expect(BaseEmbeddingOutputMock).not.toHaveBeenCalled();
  });

  it("throws when embeddings is an object with no recognized embedding type", () => {
    const mockResult = {
      response_type: "embeddings_by_type",
      embeddings: { something_new: [[0.1]] },
    } as unknown as CohereBedrockEmbeddingApiResponseOutput;

    deepCloneMock.mockReturnValueOnce(mockResult);

    expect(() =>
      CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" })
    ).toThrow(/Expected float embeddings.*received object with keys: \[something_new\]/);
    expect(BaseEmbeddingOutputMock).not.toHaveBeenCalled();
  });

  describe("multimodal responses", () => {
    it("resolves a multimodal (inputs) response from embeddings.float", () => {
      // A request that used the `inputs` field returns the same envelope as a
      // `texts` request: response_type "embeddings_by_type" with a float key.
      // `texts` is absent because the request carried no texts field.
      const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
        id: "mm-1",
        response_type: "embeddings_by_type",
        embeddings: {
          float: [[0.11, 0.22, 0.33]],
        },
      };

      deepCloneMock.mockReturnValueOnce(mockResult);

      CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" });

      expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "mm-1",
          model: "cohere.embed-v4:0",
          embedding: [[0.11, 0.22, 0.33]],
        })
      );
    });

    it("keeps batch order across a multi-item multimodal batch", () => {
      const mockResult: CohereBedrockEmbeddingApiResponseOutput = {
        response_type: "embeddings_by_type",
        embeddings: {
          float: [
            [1, 0],
            [0, 1],
            [1, 1],
          ],
        },
      };

      deepCloneMock.mockReturnValueOnce(mockResult);

      CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" });

      expect(BaseEmbeddingOutputMock).toHaveBeenCalledWith(
        expect.objectContaining({
          embedding: [
            [1, 0],
            [0, 1],
            [1, 1],
          ],
        })
      );
    });
  });

  describe("typed response-shape errors", () => {
    it("throws LlmExeError with embedding.invalid_response_shape for an unrequested type", () => {
      const mockResult = {
        response_type: "embeddings_by_type",
        embeddings: { int8: [[1, 2, 3]] },
      } as unknown as CohereBedrockEmbeddingApiResponseOutput;

      deepCloneMock.mockReturnValueOnce(mockResult);

      try {
        CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" });
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("embedding.invalid_response_shape");
        expect((e as LlmExeError).category).toBe("embedding");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("CohereBedrockEmbedding.resolveEmbeddings");
        expect(ctx.provider).toBe("amazon:cohere.embedding");
        expect(ctx.model).toBe("cohere.embed-v4:0");
        expect(ctx.received).toEqual(["int8"]);
      }
    });

    it("throws LlmExeError with embedding.invalid_response_shape for a missing embeddings field", () => {
      const mockResult = {} as CohereBedrockEmbeddingApiResponseOutput;

      deepCloneMock.mockReturnValueOnce(mockResult);

      try {
        CohereBedrockEmbedding(mockResult, { model: "cohere.embed-v4:0" });
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("embedding.invalid_response_shape");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.received).toBe("undefined");
      }
    });
  });
});
