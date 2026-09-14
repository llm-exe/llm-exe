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

  it("converts an assistant function_call into ollama tool_calls", () => {
    const messages: IChatMessages = [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: null,
        function_call: {
          id: "call_1",
          name: "get_weather",
          arguments: '{"city":"Denver"}',
        },
      } as any,
    ];

    const result = ollamaPromptSanitize(messages);

    expect(result[1]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          function: { name: "get_weather", arguments: { city: "Denver" } },
        },
      ],
    });
    expect(result[1]).not.toHaveProperty("function_call");
  });

  it("converts parallel function_call arrays into multiple tool_calls", () => {
    const messages: IChatMessages = [
      {
        role: "assistant",
        content: null,
        function_call: [
          { id: "call_1", name: "get_weather", arguments: '{"city":"Denver"}' },
          { id: "call_2", name: "get_time", arguments: { tz: "MST" } },
        ],
      } as any,
    ];

    expect(ollamaPromptSanitize(messages)[0]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        { function: { name: "get_weather", arguments: { city: "Denver" } } },
        { function: { name: "get_time", arguments: { tz: "MST" } } },
      ],
    });
  });

  it("converts a function result message into a tool message", () => {
    const messages: IChatMessages = [
      {
        role: "function",
        id: "call_1",
        name: "get_weather",
        content: "72 and sunny",
      } as any,
    ];

    const result = ollamaPromptSanitize(messages);

    expect(result[0]).toEqual({ role: "tool", content: "72 and sunny" });
    expect(result[0]).not.toHaveProperty("id");
    expect(result[0]).not.toHaveProperty("name");
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
});
