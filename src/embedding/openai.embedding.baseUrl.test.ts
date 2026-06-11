import { apiRequest } from "@/utils/modules/request";
import { createEmbedding } from "./embedding";

jest.mock("@/utils/modules/request", () => ({
  apiRequest: jest.fn(),
}));

const apiRequestMock = apiRequest as jest.Mock;

const okEmbeddingResponse = {
  object: "list",
  model: "Qwen/Qwen3-Embedding-8B",
  data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2, 0.3] }],
  usage: { prompt_tokens: 4, total_tokens: 4 },
};

describe("openai.embedding.v1 baseUrl override", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiRequestMock.mockResolvedValue(okEmbeddingResponse);
  });

  it("defaults to OpenAI when baseUrl is omitted", async () => {
    const embed = createEmbedding("openai.embedding.v1", {
      openAiApiKey: "sk-test",
      model: "text-embedding-3-small",
    });

    await embed.call("hello");

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = apiRequestMock.mock.calls[0];
    expect(calledUrl).toBe("https://api.openai.com/v1/embeddings");
  });

  it("templates the user-supplied baseUrl into the request URL", async () => {
    const embed = createEmbedding("openai.embedding.v1", {
      baseUrl: "https://model-xyz.api.baseten.co/environments/production/sync/v1",
      openAiApiKey: "baseten-key",
      model: "Qwen/Qwen3-Embedding-8B",
    });

    await embed.call("hello");

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = apiRequestMock.mock.calls[0];
    expect(calledUrl).toBe(
      "https://model-xyz.api.baseten.co/environments/production/sync/v1/embeddings"
    );
    // Authorization header carries the user's bearer token, whatever provider.
    expect(calledOptions.headers.Authorization).toBe("Bearer baseten-key");
    const body = JSON.parse(calledOptions.body);
    expect(body.model).toBe("Qwen/Qwen3-Embedding-8B");
    expect(body.input).toBe("hello");
  });
});
