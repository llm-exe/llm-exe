import { IChatMessages } from "@/types";
import { ollamaPromptSanitize } from "./promptSanitize";

describe("ollamaPromptSanitize", () => {
  it("wraps a string prompt in a user message", () => {
    expect(ollamaPromptSanitize("Hello")).toEqual([
      { role: "user", content: "Hello" },
    ]);
  });

  it("passes string-content messages through unchanged", () => {
    const messages: IChatMessages = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
    ];

    expect(ollamaPromptSanitize(messages)).toEqual(messages);
  });

  it("splits array content into content text and base64 images", () => {
    const messages: IChatMessages = [
      {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      },
    ];

    expect(ollamaPromptSanitize(messages)).toEqual([
      {
        role: "user",
        content: "What is in this image?",
        images: ["iVBORw0KGgo="],
      },
    ]);
  });

  it("joins multiple text blocks with newlines", () => {
    const messages: IChatMessages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Line one" },
          { type: "text", text: "Line two" },
        ],
      },
    ];

    expect(ollamaPromptSanitize(messages)).toEqual([
      { role: "user", content: "Line one\nLine two" },
    ]);
  });

  it("collects multiple images and omits images key when none", () => {
    const messages: IChatMessages = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,aaa=" },
          },
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64,bbb=" },
          },
        ],
      },
      { role: "user", content: [{ type: "text", text: "text only" }] },
    ];

    const result = ollamaPromptSanitize(messages);

    expect(result[0]).toEqual({
      role: "user",
      content: "",
      images: ["aaa=", "bbb="],
    });
    expect(result[1]).toEqual({ role: "user", content: "text only" });
    expect(result[1]).not.toHaveProperty("images");
  });

  it("throws for remote image URLs", () => {
    const messages: IChatMessages = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "https://example.com/cat.png" },
          },
        ],
      },
    ];

    expect(() => ollamaPromptSanitize(messages)).toThrow(
      /Image URLs are not supported by ollama/
    );
  });

  it("throws for unrecognized content blocks", () => {
    const messages: IChatMessages = [
      {
        role: "user",
        content: [{ type: "audio", audio: { data: "abc" } } as any],
      },
    ];

    expect(() => ollamaPromptSanitize(messages)).toThrow(
      /Unsupported content block for ollama/
    );
  });

  it("throws for an image block on a function message", () => {
    const messages = [
      {
        role: "function",
        name: "screenshot",
        content: [
          { type: "text", text: "here is the page" },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
          },
        ],
      },
    ] as unknown as IChatMessages;

    expect(() => ollamaPromptSanitize(messages)).toThrow(
      /Images in tool results are not supported by ollama/
    );

    try {
      ollamaPromptSanitize(messages);
    } catch (error: any) {
      expect(error.code).toEqual("prompt.invalid_messages");
      expect(error.context.provider).toEqual("ollama.chat");
      expect(error.context.resolution).toEqual(expect.any(String));
    }
  });

  it("still joins text-only content blocks on a function message", () => {
    const messages = [
      {
        role: "function",
        name: "lookup",
        content: [
          { type: "text", text: "line one" },
          { type: "text", text: "line two" },
        ],
      },
    ] as unknown as IChatMessages;

    const result = ollamaPromptSanitize(messages);

    expect(result[0]).toEqual({
      role: "function",
      name: "lookup",
      content: "line one\nline two",
    });
    expect(result[0]).not.toHaveProperty("images");
  });

  it("still allows images on user messages adjacent to a function message", () => {
    const messages = [
      { role: "function", name: "lookup", content: "plain text result" },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,aaa=" },
          },
        ],
      },
    ] as unknown as IChatMessages;

    const result = ollamaPromptSanitize(messages);

    expect(result[0]).toEqual({
      role: "function",
      name: "lookup",
      content: "plain text result",
    });
    expect(result[1]).toEqual({
      role: "user",
      content: "",
      images: ["aaa="],
    });
  });
});
