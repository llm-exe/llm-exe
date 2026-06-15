
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
});