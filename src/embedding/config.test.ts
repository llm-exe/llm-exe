import { EmbeddingProviderKey } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { embeddingConfigs, getEmbeddingConfig } from "./config";

jest.mock("@/utils/modules/getEnvironmentVariable");

describe("getEmbeddingConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the correct configuration for 'openai.embedding.v1'", () => {
    const provider: EmbeddingProviderKey = "openai.embedding.v1";
    const config = getEmbeddingConfig(provider);

    expect(config).toEqual(embeddingConfigs[provider]);
  });

  it("should return the correct configuration for 'amazon.embedding.v1'", () => {
    const provider: EmbeddingProviderKey = "amazon.embedding.v1";

    (getEnvironmentVariable as jest.Mock).mockReturnValue("us-west-2");

    const config = getEmbeddingConfig(provider);
    expect(config).toEqual({
      ...embeddingConfigs[provider],
      options: {
        ...embeddingConfigs[provider].options,
        awsRegion: {
          default: undefined,
          required: [true, "aws region is required"],
        },
      },
    });
  });

  it("should return the correct configuration for 'amazon:cohere.embedding.v1'", () => {
    const provider: EmbeddingProviderKey = "amazon:cohere.embedding.v1";

    (getEnvironmentVariable as jest.Mock).mockReturnValue("us-west-2");

    const config = getEmbeddingConfig(provider);
    expect(config).toEqual({
      ...embeddingConfigs[provider],
      options: {
        ...embeddingConfigs[provider].options,
        awsRegion: {
          default: undefined,
          required: [true, "aws region is required"],
        },
      },
    });
  });

  it("should throw an error for an invalid provider", () => {
    const invalidProvider = "invalid.provider" as EmbeddingProviderKey;
    expect(() => getEmbeddingConfig(invalidProvider)).toThrowError(
      `Invalid provider: ${invalidProvider}`
    );
  });

  it("should throw an error for a missing provider", () => {
    const invalidProvider = "" as EmbeddingProviderKey;
    expect(() => getEmbeddingConfig(invalidProvider)).toThrowError(
      `Missing provider`
    );
  });
});

describe("embeddingConfigs", () => {
  it("should contain 'openai.embedding.v1' with correct values", () => {
    const provider: EmbeddingProviderKey = "openai.embedding.v1";
    const config = embeddingConfigs[provider];

    expect(config).toEqual({
      key: "openai.embedding.v1",
      provider: "openai.embedding",
      endpoint: "{{baseUrl}}/embeddings",
      method: "POST",
      headers: `{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json" }`,
      options: {
        input: {},
        dimensions: {
          default: 1536,
        },
        encodingFormat: {},
        openAiApiKey: {},
        baseUrl: {
          default: "https://api.openai.com/v1",
        },
      },
      mapBody: {
        input: {
          key: "input",
        },
        model: {
          key: "model",
        },
        dimensions: {
          key: "dimensions",
        },
        encodingFormat: {
          key: "encoding_format",
        },
      },
    });
  });

  it("should contain 'amazon.embedding.v1' with correct values", () => {
    const provider: EmbeddingProviderKey = "amazon.embedding.v1";
    (getEnvironmentVariable as jest.Mock).mockReturnValue("us-west-2");

    const config = embeddingConfigs[provider];

    expect(config).toEqual({
      key: "amazon.embedding.v1",
      provider: "amazon.embedding",
      endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
      method: "POST",
      headers: `{"Content-Type": "application/json" }`,
      options: {
        input: {},
        dimensions: {
          default: 512,
        },
        awsRegion: expect.objectContaining({
          default: undefined,
          required: [true, "aws region is required"],
        }),
        awsSecretKey: {},
        awsAccessKey: {},
      },
      mapBody: {
        input: {
          key: "inputText",
        },
        dimensions: {
          key: "dimensions",
        },
      },
    });
  });

  it("should contain 'amazon:cohere.embedding.v1' with correct values", () => {
    const provider: EmbeddingProviderKey = "amazon:cohere.embedding.v1";
    (getEnvironmentVariable as jest.Mock).mockReturnValue("us-west-2");

    const config = embeddingConfigs[provider];

    expect(config).toEqual({
      key: "amazon:cohere.embedding.v1",
      provider: "amazon:cohere.embedding",
      endpoint: `https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke`,
      method: "POST",
      headers: `{"Content-Type": "application/json" }`,
      options: {
        input: {},
        inputType: {
          default: "search_document",
        },
        truncate: {},
        dimensions: {},
        awsRegion: expect.objectContaining({
          default: undefined,
          required: [true, "aws region is required"],
        }),
        awsSecretKey: {},
        awsAccessKey: {},
      },
      mapBody: {
        input: {
          key: "texts",
          transform: expect.any(Function),
        },
        inputType: {
          key: "input_type",
        },
        truncate: {
          key: "truncate",
        },
        dimensions: {
          key: "output_dimension",
          transform: expect.any(Function),
        },
      },
    });
  });

  describe("dimensions transform on 'amazon:cohere.embedding.v1'", () => {
    const provider: EmbeddingProviderKey = "amazon:cohere.embedding.v1";
    function getTransform() {
      const transform =
        embeddingConfigs[provider].mapBody.dimensions.transform;
      if (!transform) {
        throw new Error("dimensions transform is missing from config");
      }
      return transform;
    }

    it("drops the field when dimensions=1024 against Embed v3 (no-op, v3 returns 1024)", () => {
      const transform = getTransform();
      expect(
        transform(1024, { model: "cohere.embed-english-v3" }, {})
      ).toBeUndefined();
      expect(
        transform(1024, { model: "cohere.embed-multilingual-v3" }, {})
      ).toBeUndefined();
    });

    it("throws when dimensions != 1024 against Embed v3 (don't silently mutate intent)", () => {
      const transform = getTransform();
      expect(() =>
        transform(512, { model: "cohere.embed-english-v3" }, {})
      ).toThrow(/Cohere Embed v3 only supports 1024-dimensional output/);
      expect(() =>
        transform(256, { model: "cohere.embed-multilingual-v3" }, {})
      ).toThrow(/requested: 256/);
    });

    it("passes the value through for Embed v4 and unknown models (Cohere validates)", () => {
      const transform = getTransform();
      expect(transform(512, { model: "cohere.embed-v4:0" }, {})).toBe(512);
      expect(transform(1024, { model: "cohere.embed-v4" }, {})).toBe(1024);
      expect(transform(256, { model: "cohere.embed-v4:0" }, {})).toBe(256);
      expect(transform(1536, { model: "cohere.embed-v4:0" }, {})).toBe(1536);
    });

    it("returns undefined when no dimensions value is supplied", () => {
      const transform = getTransform();
      expect(
        transform(undefined, { model: "cohere.embed-v4:0" }, {})
      ).toBeUndefined();
      expect(
        transform(undefined, { model: "cohere.embed-english-v3" }, {})
      ).toBeUndefined();
    });

    it("treats missing model in state as non-v3 (passes value through)", () => {
      const transform = getTransform();
      expect(transform(512, {}, {})).toBe(512);
      expect(transform(1024, {}, {})).toBe(1024);
    });

    it("treats undefined state.model as non-v3", () => {
      const transform = getTransform();
      expect(transform(256, { model: undefined }, {})).toBe(256);
    });

    it("treats empty string model as non-v3", () => {
      const transform = getTransform();
      expect(transform(768, { model: "" }, {})).toBe(768);
    });
  });

  it("input transform on 'amazon:cohere.embedding.v1' wraps strings into arrays", () => {
    const provider: EmbeddingProviderKey = "amazon:cohere.embedding.v1";
    const transform = embeddingConfigs[provider].mapBody.input.transform;
    if (!transform) {
      throw new Error("input transform is missing from config");
    }

    expect(transform("hello", {}, {})).toEqual(["hello"]);
    expect(transform(["hello", "world"], {}, {})).toEqual(["hello", "world"]);
  });
});
