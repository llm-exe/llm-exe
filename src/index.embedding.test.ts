import type {
  CohereBedrockEmbeddingOptions,
  EmbeddingContentItem,
  EmbeddingInput,
} from "./index";

describe("public embedding type exports", () => {
  it("exports EmbeddingContentItem and EmbeddingInput from the root", () => {
    const item: EmbeddingContentItem = {
      content: [
        { type: "text", text: "a red square" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
      ],
    };
    const textInput: EmbeddingInput = ["hello", "world"];
    const multimodalInput: EmbeddingInput = [item];

    expect(item.content).toHaveLength(2);
    expect(textInput).toHaveLength(2);
    expect(multimodalInput).toHaveLength(1);
  });

  it("exports CohereBedrockEmbeddingOptions with imageInputs", () => {
    const options: CohereBedrockEmbeddingOptions = {
      model: "cohere.embed-v4:0",
      awsRegion: "us-east-1",
      imageInputs: [{ content: [{ type: "text", text: "hi" }] }],
    };
    expect(options.imageInputs).toHaveLength(1);
  });
});
