
import {
  apiRequest
} from "@/utils/modules/request";
import {
  replaceTemplateStringSimple
} from "@/utils/modules/replaceTemplateStringSimple";
import {
  mapBody
} from "@/llm/_utils.mapBody";
import {
  parseHeaders
} from "@/llm/_utils.parseHeaders";
import {
  getEmbeddingConfig
} from "./config";
import {
  getEmbeddingOutputParser
} from "./output/getEmbeddingOutputParser";
import {
  GenericLLm,
  LlmProvider,
  EmbeddingProviderKey,
} from "@/types";
import { createEmbedding_call } from "./embedding.call";
import { LlmExeError } from "@/errors";

// Mock external dependencies
jest.mock("@/utils/modules/request");
jest.mock("@/utils/modules/replaceTemplateStringSimple");
jest.mock("@/llm/_utils.mapBody");
jest.mock("@/llm/_utils.parseHeaders");
jest.mock("./config");
jest.mock("./output/getEmbeddingOutputParser");

describe("createEmbedding_call", () => {
  const apiRequestMock = apiRequest as jest.Mock;
  const replaceTemplateStringSimpleMock = replaceTemplateStringSimple as jest.Mock;
  const mapBodyMock = mapBody as jest.Mock;
  const parseHeadersMock = parseHeaders as jest.Mock;
  const getEmbeddingConfigMock = getEmbeddingConfig as jest.Mock;
  const getEmbeddingOutputParserMock = getEmbeddingOutputParser as jest.Mock;

  const mockState: GenericLLm & {
    provider: Extract < LlmProvider, "openai.embedding" > ;
    key: EmbeddingProviderKey;
  } = {
    provider: "openai.embedding",
    key: "test-key",
    // other GenericLLm fields...
  } as any;

  const mockConfig = {
    endpoint: "https://api.example.com/endpoint",
    method: "POST",
    mapBody: jest.fn(),
  };

  const mockParsedHeaders = {
    "Content-Type": "application/json"
  };

  beforeEach(() => {
    jest.clearAllMocks();

    getEmbeddingConfigMock.mockReturnValue(mockConfig);
    replaceTemplateStringSimpleMock.mockReturnValue("https://api.example.com/endpoint");
    parseHeadersMock.mockResolvedValue(mockParsedHeaders);
    apiRequestMock.mockResolvedValue({
      data: { data: "mockResponse" },
      headers: {},
    });
    getEmbeddingOutputParserMock.mockReturnValue({
      embeddedData: "parsedData"
    });
  });

  it("should create embedding call with valid parameters", async () => {
    const input = "test input";
    mapBodyMock.mockReturnValueOnce({})

    const result = await createEmbedding_call(mockState, input);

    expect(getEmbeddingConfigMock).toHaveBeenCalledWith(mockState.key);
    expect(mapBodyMock).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      input
    });
    expect(replaceTemplateStringSimpleMock).toHaveBeenCalledWith(mockConfig.endpoint, mockState);
    expect(parseHeadersMock).toHaveBeenCalledWith(mockConfig, mockState, {
      url: mockConfig.endpoint,
      headers: expect.any(Object),
      body: JSON.stringify({})
    });
    expect(apiRequestMock).toHaveBeenCalledWith(mockConfig.endpoint, {
      method: mockConfig.method,
      body: JSON.stringify({}),
      headers: mockParsedHeaders,
    });
    expect(getEmbeddingOutputParserMock).toHaveBeenCalledWith(
      mockState,
      { data: "mockResponse" },
      {}
    );
    expect(result).toEqual({
      embeddedData: "parsedData"
    });
  });

  it("should handle array input correctly", async () => {
    const input = ["test input 1", "test input 2"];
    mapBodyMock.mockReturnValueOnce({})

    const result = await createEmbedding_call(mockState, input);

    expect(getEmbeddingConfigMock).toHaveBeenCalledWith(mockState.key);
    expect(mapBodyMock).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      input
    });
    expect(replaceTemplateStringSimpleMock).toHaveBeenCalledWith(mockConfig.endpoint, mockState);
    expect(parseHeadersMock).toHaveBeenCalledWith(mockConfig, mockState, {
      url: mockConfig.endpoint,
      headers: expect.any(Object),
      body: JSON.stringify({})
    });
    expect(apiRequestMock).toHaveBeenCalledWith(mockConfig.endpoint, {
      method: mockConfig.method,
      body: JSON.stringify({}),
      headers: mockParsedHeaders,
    });
    expect(getEmbeddingOutputParserMock).toHaveBeenCalledWith(
      mockState,
      { data: "mockResponse" },
      {}
    );
    expect(result).toEqual({
      embeddedData: "parsedData"
    });
  });

  it("should handle stringified input correctly", async () => {
    const input = JSON.stringify({ test: "input" });
    mapBodyMock.mockReturnValueOnce({})

    const result = await createEmbedding_call(mockState, input);

    expect(getEmbeddingConfigMock).toHaveBeenCalledWith(mockState.key);
    expect(mapBodyMock).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      input
    });
    expect(replaceTemplateStringSimpleMock).toHaveBeenCalledWith(mockConfig.endpoint, mockState);
    expect(parseHeadersMock).toHaveBeenCalledWith(mockConfig, mockState, {
      url: mockConfig.endpoint,
      headers: expect.any(Object),
      body: JSON.stringify({})
    });
    expect(apiRequestMock).toHaveBeenCalledWith(mockConfig.endpoint, {
      method: mockConfig.method,
      body: JSON.stringify({}),
      headers: mockParsedHeaders,
    });
    expect(getEmbeddingOutputParserMock).toHaveBeenCalledWith(
      mockState,
      { data: "mockResponse" },
      {}
    );
    expect(result).toEqual({
      embeddedData: "parsedData"
    });
  });


  it("should handle options parameter correctly", async () => {
    const input = "test input";
    const options: any = {
      someOption: "value"
    };
    mapBodyMock.mockReturnValueOnce({})

    const result = await createEmbedding_call(mockState, input, options);

    expect(getEmbeddingConfigMock).toHaveBeenCalledWith(mockState.key);
    expect(mapBodyMock).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      input
    });
    expect(replaceTemplateStringSimpleMock).toHaveBeenCalledWith(mockConfig.endpoint, mockState);
    expect(parseHeadersMock).toHaveBeenCalledWith(mockConfig, mockState, {
      url: mockConfig.endpoint,
      headers: expect.any(Object),
      body: JSON.stringify({})
    });
    expect(apiRequestMock).toHaveBeenCalledWith(mockConfig.endpoint, {
      method: mockConfig.method,
      body: JSON.stringify({}),
      headers: mockParsedHeaders,
    });
    expect(getEmbeddingOutputParserMock).toHaveBeenCalledWith(
      mockState,
      { data: "mockResponse" },
      {}
    );
    expect(result).toEqual({
      embeddedData: "parsedData"
    });
  });

  it("forwards response headers to getEmbeddingOutputParser", async () => {
    const responseHeaders = {
      "x-amzn-bedrock-input-token-count": "11",
      "x-amzn-bedrock-output-token-count": "0",
    };
    apiRequestMock.mockResolvedValueOnce({
      data: { data: "mockResponse" },
      headers: responseHeaders,
    });
    mapBodyMock.mockReturnValueOnce({});

    await createEmbedding_call(mockState, "test input");

    expect(getEmbeddingOutputParserMock).toHaveBeenCalledWith(
      mockState,
      { data: "mockResponse" },
      responseHeaders
    );
  });

  it("should handle apiRequest errors", async () => {
    apiRequestMock.mockRejectedValue(new Error("API Error"));
    mapBodyMock.mockReturnValueOnce({})

    const input = "test input";

    await expect(createEmbedding_call(mockState, input)).rejects.toThrow("API Error");

    expect(getEmbeddingConfigMock).toHaveBeenCalledWith(mockState.key);
    expect(mapBodyMock).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      input
    });
    expect(replaceTemplateStringSimpleMock).toHaveBeenCalledWith(mockConfig.endpoint, mockState);
    expect(parseHeadersMock).toHaveBeenCalledWith(mockConfig, mockState, {
      url: mockConfig.endpoint,
      headers: expect.any(Object),
      body: JSON.stringify({})
    });
    expect(apiRequestMock).toHaveBeenCalledWith(mockConfig.endpoint, {
      method: mockConfig.method,
      body: JSON.stringify({}),
      headers: mockParsedHeaders,
    });
  });

  it("should handle parseHeaders errors", async () => {
    parseHeadersMock.mockRejectedValue(new Error("Header Error"));
    mapBodyMock.mockReturnValueOnce({})

    const input = "test input";

    await expect(createEmbedding_call(mockState, input)).rejects.toThrow("Header Error");

    expect(getEmbeddingConfigMock).toHaveBeenCalledWith(mockState.key);
    expect(mapBodyMock).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      input
    });
    expect(replaceTemplateStringSimpleMock).toHaveBeenCalledWith(mockConfig.endpoint, mockState);
    expect(parseHeadersMock).toHaveBeenCalledWith(mockConfig, mockState, {
      url: mockConfig.endpoint,
      headers: expect.any(Object),
      body: JSON.stringify({})
    });
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  describe("apiRequest wrap maps request.http_error -> embedding.provider_*", () => {
    function makeRequestError(status: number) {
      return new LlmExeError(`Request failed: ${status}`, {
        code: "request.http_error",
        context: {
          operation: "apiRequest",
          url: "https://api.openai.com/v1/embeddings",
          status,
          statusText: "Status",
          providerError: { message: "provider says no" },
        },
      });
    }

    beforeEach(() => {
      mapBodyMock.mockReturnValue({});
      parseHeadersMock.mockResolvedValue({});
    });

    it.each([
      [429, "embedding.provider_rate_limited"],
      [401, "embedding.provider_auth_failed"],
      [400, "embedding.provider_invalid_request"],
      [503, "embedding.provider_unavailable"],
      [418, "embedding.provider_http_error"],
    ])(
      "maps status %i to %s",
      async (status, expectedCode) => {
        apiRequestMock.mockRejectedValue(makeRequestError(status));
        try {
          await createEmbedding_call(mockState, "x");
          throw new Error("Expected an error to be thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(LlmExeError);
          expect((e as InstanceType<typeof LlmExeError>).code).toBe(expectedCode);
          expect((e as InstanceType<typeof LlmExeError>).category).toBe("embedding");
          const ctx = (e as InstanceType<typeof LlmExeError>).context as Record<
            string,
            unknown
          >;
          expect(ctx.provider).toBe("openai.embedding");
          expect(ctx.status).toBe(status);
          expect(ctx.providerError).toEqual({ message: "provider says no" });
          expect((e as unknown as { cause?: unknown }).cause).toBeDefined();
        }
      }
    );

    it("falls back to embedding.provider_http_error when no status is present", async () => {
      const err = new LlmExeError("network down", {
        code: "request.http_error",
        context: {
          operation: "apiRequest",
          url: "https://api.openai.com/v1/embeddings",
        },
      });
      apiRequestMock.mockRejectedValue(err);
      try {
        await createEmbedding_call(mockState, "x");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect((e as InstanceType<typeof LlmExeError>).code).toBe(
          "embedding.provider_http_error"
        );
      }
    });

    it("tolerates a request.http_error that carries no context", async () => {
      const err = new LlmExeError("no context at all", {
        code: "request.http_error",
      });
      apiRequestMock.mockRejectedValue(err);
      try {
        await createEmbedding_call(mockState, "x");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        const wrapped = e as InstanceType<typeof LlmExeError>;
        expect(wrapped.code).toBe("embedding.provider_http_error");
        const ctx = wrapped.context as Record<string, unknown>;
        // ctx defaulted to {} then enriched with operation/provider/model
        expect(ctx.operation).toBe("createEmbedding_call");
        expect(ctx.provider).toBe("openai.embedding");
        expect((e as unknown as { cause?: unknown }).cause).toBe(err);
      }
    });

    it("does not wrap non-request.http_error errors", async () => {
      apiRequestMock.mockRejectedValue(
        new LlmExeError("bad url", {
          code: "request.invalid_url",
          context: { operation: "apiRequest", url: "x" },
        })
      );
      try {
        await createEmbedding_call(mockState, "x");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect((e as InstanceType<typeof LlmExeError>).code).toBe(
          "request.invalid_url"
        );
      }
    });
  });
});