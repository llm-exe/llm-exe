import { LlmExeError } from "@/errors";
import { isImageUrlContentBlock, parseImageUrl } from "./imageContent";

const errorContext = { operation: "test", provider: "test.chat" };

describe("isImageUrlContentBlock", () => {
  it("returns true for a canonical image_url block", () => {
    expect(
      isImageUrlContentBlock({
        type: "image_url",
        image_url: { url: "https://example.com/cat.png" },
      })
    ).toBe(true);
  });

  it("returns true for legacy blocks with a non-standard type", () => {
    expect(
      isImageUrlContentBlock({
        type: "image",
        image_url: { url: "https://example.com/cat.png" },
      })
    ).toBe(true);
  });

  it("returns false for text blocks", () => {
    expect(isImageUrlContentBlock({ type: "text", text: "hello" })).toBe(
      false
    );
  });

  it("returns false for null and non-objects", () => {
    expect(isImageUrlContentBlock(null)).toBe(false);
    expect(isImageUrlContentBlock(undefined)).toBe(false);
    expect(isImageUrlContentBlock("image")).toBe(false);
  });

  it("returns false when image_url is missing a string url", () => {
    expect(isImageUrlContentBlock({ type: "image_url" })).toBe(false);
    expect(
      isImageUrlContentBlock({ type: "image_url", image_url: null })
    ).toBe(false);
    expect(
      isImageUrlContentBlock({ type: "image_url", image_url: { url: 42 } })
    ).toBe(false);
  });
});

describe("parseImageUrl", () => {
  it("parses a base64 data: URI into media type and data", () => {
    expect(
      parseImageUrl("data:image/png;base64,iVBORw0KGgo=", errorContext)
    ).toEqual({
      kind: "base64",
      mediaType: "image/png",
      data: "iVBORw0KGgo=",
    });
  });

  it("returns url kind for https URLs", () => {
    expect(parseImageUrl("https://example.com/cat.png", errorContext)).toEqual(
      {
        kind: "url",
        url: "https://example.com/cat.png",
      }
    );
  });

  it("returns url kind for non-http schemes like gs://", () => {
    expect(parseImageUrl("gs://bucket/cat.png", errorContext)).toEqual({
      kind: "url",
      url: "gs://bucket/cat.png",
    });
  });

  it("throws on an empty url", () => {
    expect(() => parseImageUrl("", errorContext)).toThrow(LlmExeError);
    expect(() => parseImageUrl("  ", errorContext)).toThrow(
      /empty url/
    );
  });

  it("throws on a data: URI without a media type", () => {
    expect(() =>
      parseImageUrl("data:;base64,iVBORw0KGgo=", errorContext)
    ).toThrow(/Malformed data: URI/);
  });

  it("throws on a non-base64 data: URI", () => {
    expect(() =>
      parseImageUrl("data:image/png,rawbytes", errorContext)
    ).toThrow(/Malformed data: URI/);
  });

  it("throws LlmExeError with prompt.invalid_messages code", () => {
    try {
      parseImageUrl("data:image/png,rawbytes", errorContext);
      throw new Error("expected parseImageUrl to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmExeError);
      const llmExeError = error as LlmExeError<"prompt.invalid_messages">;
      expect(llmExeError.code).toBe("prompt.invalid_messages");
      expect(llmExeError.context?.provider).toBe("test.chat");
    }
  });
});
