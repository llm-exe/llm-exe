import { OutputResultContent } from "@/interfaces";
import { getResultText } from "@/llm/output/_utils/getResultText";
import { mockOutputResultObject } from "../../../../utils/mock.helpers";

describe("getResultText", () => {
  it("should return text when there is only one item and its type is 'text'", () => {
    const content: OutputResultContent[] = [
      { type: "text", text: "hello world" },
    ];

    expect(getResultText(mockOutputResultObject(content))).toBe("hello world");
  });

  it("should return first string when there is more than one item", () => {
    const content: OutputResultContent[] = [
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ];

    expect(getResultText(mockOutputResultObject(content))).toBe("hello");
  });

  it("should return an empty string when the item type is not 'text'", () => {
    const content: OutputResultContent[] = [
      { type: "image" as any, text: "hello world" },
    ];

    expect(getResultText(mockOutputResultObject(content))).toBe("");
  });

  it("should return an empty string when content is empty", () => {
    const content: OutputResultContent[] = [];

    expect(getResultText(mockOutputResultObject(content))).toBe("");
  });

  it("should return an empty string when the single item has no text", () => {
    const content: OutputResultContent[] = [{ type: "text", text: "" }];

    expect(getResultText(mockOutputResultObject(content))).toBe("");
  });

  describe("with index parameter", () => {
    it("should return text from options array at specified index", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: OutputResultContent[][] = [
        [{ type: "text", text: "choice 1" }],
        [{ type: "text", text: "choice 2" }],
      ];

      const result = mockOutputResultObject(content, options);
      // options holds only alternates: choice N is options[N - 1]
      expect(getResultText(result, 1)).toBe("choice 1");
      expect(getResultText(result, 2)).toBe("choice 2");
      expect(getResultText(result, 3)).toBe("");
    });

    it("should return empty string when index is out of bounds", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: OutputResultContent[][] = [
        [{ type: "text", text: "option 0" }],
      ];

      const result = mockOutputResultObject(content, options);
      expect(getResultText(result, 5)).toBe("");
    });

    it("should return empty string when options array is empty", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: any[] = [];

      const result = mockOutputResultObject(content, options);
      expect(getResultText(result, 1)).toBe("");
    });

    it("should return empty string when options item is not text type", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: OutputResultContent[][] = [
        [{ type: "function_use", name: "test", input: {} } as any],
      ];

      const result = mockOutputResultObject(content, options);
      expect(getResultText(result, 1)).toBe("");
    });

    it("should return empty string when options item has no content", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: OutputResultContent[][] = [
        [], // empty array for choice 1
      ];

      const result = mockOutputResultObject(content, options);
      expect(getResultText(result, 1)).toBe("");
    });

    it("should return main content when index is 0", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: OutputResultContent[][] = [
        [{ type: "text", text: "option 0" }],
        [{ type: "text", text: "option 1" }],
      ];

      const result = mockOutputResultObject(content, options);
      expect(getResultText(result, 0)).toBe("main content");
    });

    it("should return main content when index is negative", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];
      const options: OutputResultContent[][] = [
        [{ type: "text", text: "option 0" }],
        [{ type: "text", text: "option 1" }],
      ];

      const result = mockOutputResultObject(content, options);
      expect(getResultText(result, -1)).toBe("main content");
    });

    it("should handle when result has no options property", () => {
      const content: OutputResultContent[] = [
        { type: "text", text: "main content" },
      ];

      const result = {
        ...mockOutputResultObject(content),
        options: undefined,
      };
      expect(getResultText(result, 1)).toBe("");
    });
  });
});
