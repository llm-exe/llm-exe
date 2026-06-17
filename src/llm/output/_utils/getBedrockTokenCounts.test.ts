import { getBedrockTokenCounts } from "./getBedrockTokenCounts";

describe("getBedrockTokenCounts", () => {
  it("parses both Bedrock token-count headers", () => {
    expect(
      getBedrockTokenCounts({
        "x-amzn-bedrock-input-token-count": "13",
        "x-amzn-bedrock-output-token-count": "7",
      })
    ).toEqual({
      input_tokens: 13,
      output_tokens: 7,
    });
  });

  it("defaults a missing counterpart header to 0", () => {
    expect(
      getBedrockTokenCounts({ "x-amzn-bedrock-input-token-count": "13" })
    ).toEqual({
      input_tokens: 13,
      output_tokens: 0,
    });
  });

  it("defaults missing input header to 0 when only output is present", () => {
    expect(
      getBedrockTokenCounts({ "x-amzn-bedrock-output-token-count": "7" })
    ).toEqual({
      input_tokens: 0,
      output_tokens: 7,
    });
  });

  it("returns undefined when neither Bedrock header is present", () => {
    expect(
      getBedrockTokenCounts({ "content-type": "application/json" })
    ).toBeUndefined();
  });

  it("returns undefined when headers are undefined", () => {
    expect(getBedrockTokenCounts(undefined)).toBeUndefined();
  });

  it("returns undefined for non-numeric header values", () => {
    expect(
      getBedrockTokenCounts({
        "x-amzn-bedrock-input-token-count": "not-a-number",
      })
    ).toBeUndefined();
  });
});
