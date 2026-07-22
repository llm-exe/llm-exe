import { EmbeddingProviderKey } from "@/types";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { embeddingConfigs, getEmbeddingConfig } from "./config";
import { LlmExeError } from "@/errors";
import { mapBody } from "@/llm/_utils.mapBody";

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

  it("throws LlmExeError with embedding.invalid_provider for an invalid provider", () => {
    const invalidProvider = "invalid.provider" as EmbeddingProviderKey;
    try {
      getEmbeddingConfig(invalidProvider);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("embedding.invalid_provider");
      expect((e as LlmExeError).category).toBe("embedding");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("getEmbeddingConfig");
      expect(ctx.provider).toBe(invalidProvider);
      expect(Array.isArray(ctx.availableProviders)).toBe(true);
      expect((ctx.availableProviders as string[]).length).toBeGreaterThan(0);
    }
  });

  it("should throw an error for a missing provider", () => {
    const invalidProvider = "" as EmbeddingProviderKey;
    expect(() => getEmbeddingConfig(invalidProvider)).toThrowError(
      `Missing provider`
    );
  });

  it("throws LlmExeError with embedding.missing_provider for a missing provider", () => {
    try {
      getEmbeddingConfig("" as EmbeddingProviderKey);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("embedding.missing_provider");
      expect((e as LlmExeError).category).toBe("embedding");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("getEmbeddingConfig");
      expect(Array.isArray(ctx.availableProviders)).toBe(true);
    }
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
        imageInputs: {},
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
        imageInputs: {
          key: "inputs",
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

    it("throws LlmExeError with embedding.unsupported_dimensions for Embed v3 with bad dim", () => {
      const transform = getTransform();
      try {
        transform(512, { model: "cohere.embed-english-v3" }, {});
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("embedding.unsupported_dimensions");
        expect((e as LlmExeError).category).toBe("embedding");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("embedding.dimensionTransform");
        expect(ctx.provider).toBe("amazon:cohere.embedding");
        expect(ctx.model).toBe("cohere.embed-english-v3");
        expect(ctx.dimensions).toBe(512);
        expect(ctx.expected).toBe(1024);
      }
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

  describe("multimodal routing on 'amazon:cohere.embedding.v1'", () => {
    const provider: EmbeddingProviderKey = "amazon:cohere.embedding.v1";
    const imageItem = {
      content: [
        { type: "text" as const, text: "a red square" },
        {
          type: "image_url" as const,
          image_url: { url: "data:image/png;base64,AAAA" },
        },
      ],
    };

    function getTextsTransform() {
      const transform = embeddingConfigs[provider].mapBody.input.transform;
      if (!transform) {
        throw new Error("input transform is missing from config");
      }
      return transform;
    }

    function getInputsTransform() {
      const transform = embeddingConfigs[provider].mapBody.imageInputs.transform;
      if (!transform) {
        throw new Error("imageInputs transform is missing from config");
      }
      return transform;
    }

    it("drops `texts` when the batch is multimodal", () => {
      const transform = getTextsTransform();
      expect(
        transform([imageItem], { input: [imageItem] }, {})
      ).toBeUndefined();
    });

    it("still wraps plain text into `texts`", () => {
      const transform = getTextsTransform();
      expect(transform("hello", { input: "hello" }, {})).toEqual(["hello"]);
      expect(
        transform(["a", "b"], { input: ["a", "b"] }, {})
      ).toEqual(["a", "b"]);
    });

    it("never stringifies a content item into `texts`", () => {
      const transform = getTextsTransform();
      const result = transform([imageItem], { input: [imageItem] }, {});
      expect(JSON.stringify(result ?? null)).not.toContain("image_url");
    });

    it("throws embedding.unsupported_input on a mixed batch", () => {
      const transform = getTextsTransform();
      try {
        transform(["a", imageItem], { input: ["a", imageItem] }, {});
        fail("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("embedding.unsupported_input");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("embedding.textsTransform");
        expect(ctx.provider).toBe("amazon:cohere.embedding");
        expect(ctx.inputKind).toBe("mixed");
      }
    });

    it("drops `texts` for a text call input when an imageInputs option is also set", () => {
      // `texts` and `inputs` are mutually exclusive on the wire — a text call
      // input combined with the `imageInputs` escape hatch must still omit
      // `texts`, or Cohere rejects the request for carrying both fields.
      const transform = getTextsTransform();
      expect(
        transform("hello", { input: "hello", imageInputs: [imageItem] }, {})
      ).toBeUndefined();
    });

    it("emits `inputs` from a multimodal call input", () => {
      const transform = getInputsTransform();
      expect(
        transform(undefined, { input: [imageItem] }, {})
      ).toEqual([imageItem]);
    });

    it("omits `inputs` for a plain text batch", () => {
      const transform = getInputsTransform();
      expect(transform(undefined, { input: "hello" }, {})).toBeUndefined();
      expect(
        transform(undefined, { input: ["a", "b"] }, {})
      ).toBeUndefined();
      expect(transform(undefined, {}, {})).toBeUndefined();
    });

    it("honours an explicit imageInputs option when the call input is text", () => {
      const transform = getInputsTransform();
      expect(
        transform([imageItem], { input: "hello", imageInputs: [imageItem] }, {})
      ).toEqual([imageItem]);
    });

    it("lets a multimodal call input win over an explicit imageInputs option", () => {
      const transform = getInputsTransform();
      const other = { content: [{ type: "text" as const, text: "other" }] };
      expect(
        transform([other], { input: [imageItem], imageInputs: [other] }, {})
      ).toEqual([imageItem]);
    });

    it("ignores a non-multimodal imageInputs option", () => {
      const transform = getInputsTransform();
      expect(
        transform("nonsense", { input: "hello", imageInputs: "nonsense" }, {})
      ).toBeUndefined();
    });
  });

  describe("mapBody composition for 'amazon:cohere.embedding.v1'", () => {
    const provider: EmbeddingProviderKey = "amazon:cohere.embedding.v1";
    const imageItem = {
      content: [
        { type: "text" as const, text: "a red square" },
        {
          type: "image_url" as const,
          image_url: { url: "data:image/png;base64,AAAA" },
        },
      ],
    };

    it("builds a texts body for a plain batch", () => {
      const body = mapBody(embeddingConfigs[provider].mapBody, {
        model: "cohere.embed-v4:0",
        input: ["hello", "world"],
        inputType: "search_document",
      });
      expect(body).toEqual({
        texts: ["hello", "world"],
        input_type: "search_document",
      });
      expect(body).not.toHaveProperty("inputs");
    });

    it("builds an inputs body for a multimodal batch and omits texts", () => {
      const body = mapBody(embeddingConfigs[provider].mapBody, {
        model: "cohere.embed-v4:0",
        input: [imageItem],
        inputType: "search_document",
      });
      expect(body).toEqual({
        inputs: [imageItem],
        input_type: "search_document",
      });
      expect(body).not.toHaveProperty("texts");
    });

    it("builds an inputs body from the imageInputs option when the call input is text, and omits texts", () => {
      const body = mapBody(embeddingConfigs[provider].mapBody, {
        model: "cohere.embed-v4:0",
        input: "hello",
        imageInputs: [imageItem],
        inputType: "search_document",
      });
      expect(body).toEqual({
        inputs: [imageItem],
        input_type: "search_document",
      });
      expect(body).not.toHaveProperty("texts");
    });

    it("lets a multimodal call input win in the composed body when an imageInputs option is also set", () => {
      const other = { content: [{ type: "text" as const, text: "other" }] };
      const body = mapBody(embeddingConfigs[provider].mapBody, {
        model: "cohere.embed-v4:0",
        input: [imageItem],
        imageInputs: [other],
        inputType: "search_document",
      });
      expect(body).toEqual({
        inputs: [imageItem],
        input_type: "search_document",
      });
      expect(body).not.toHaveProperty("texts");
    });
  });
});
