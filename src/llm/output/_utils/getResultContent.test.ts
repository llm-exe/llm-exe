import { OutputResult } from "@/interfaces";
import { getResultContent } from "@/llm/output/_utils/getResultContent";

describe("getResultContent", () => {
  it("should return the content if index is not provided", () => {
    const result: OutputResult = {
      content: [{ text: "text1", type: "text" }],
      id: "1",
      stopReason: "stop",
      usage: { 
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      created: new Date().getTime(),
      options: []
    };

    const output = getResultContent(result);

    expect(output).toEqual(result.content);
  });

  it("should return the content if index is zero", () => {
    const result: OutputResult = {
      content: [{ text: "text1", type: "text" }],
      id: "1",
      stopReason: "stop",
      usage: { 
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      created:  new Date().getTime(),
      options: []
    };

    const output = getResultContent(result, 0);

    expect(output).toEqual(result.content);
  });

  it("should return an empty array if options are empty and index is greater than zero", () => {
    const result: OutputResult = {
      content: [{ text: "text1", type: "text" }],
      id: "1",      stopReason: "stop",
      usage: { 
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      created:  new Date().getTime(),
      options: []
    };

    const output = getResultContent(result, 1);

    expect(output).toEqual([]);
  });

  it("should return the correct options array if index is valid and options exist", () => {
    const result: OutputResult = {
      content: [{ text: "text1", type: "text" }],
      id: "1",
      stopReason: "stop",
      usage: { 
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      created:  new Date().getTime(),
      options: [
        [{ text: "textOpt1", type: "text" }],
        [{ text: "textOpt2", type: "text" }],
        [{ text: "textOpt3", type: "text" }]
      ]
    };

    // options holds only alternates: choice N is options[N - 1]
    expect(getResultContent(result, 1)).toEqual([{ text: "textOpt1", type: "text" }]);
    expect(getResultContent(result, 3)).toEqual([{ text: "textOpt3", type: "text" }]);
  });

  it("should return an empty array if the index provided is out of bounds", () => {
    const result: OutputResult = {
      content: [{ text: "text1", type: "text" }],
      id: "1",
      stopReason: "stop",
      usage: { 
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      created:  new Date().getTime(),
      options: [
        [{ text: "textOpt1", type: "text" }],
        [{ text: "textOpt2", type: "text" }]
      ]
    };

    const output = getResultContent(result, 5);

    expect(output).toEqual([]);
  });

  it("should handle cases where options are not provided", () => {
    const result: Omit<OutputResult, any> = {
      content: [{ text: "text1", type: "text" }]
    };

    const output = getResultContent(result as any);

    expect(output).toEqual((result as any).content);
  });

  it("should handle cases where options are not provided", () => {
    const result: Omit<OutputResult, any> = {
      content: [{ text: "text1", type: "text" }]
    };

    const output = getResultContent(result as any, 2);
    expect(output).toEqual([]);
  });
});