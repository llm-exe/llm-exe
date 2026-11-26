import { formatResult } from "./formatResult";

describe("formatResult", () => {
  it("returns text fallback if result is undefined", () => {
    const output = formatResult(undefined as any);
    expect(output).toEqual([]);
  });

  it("returns text fallback if content is undefined", () => {
    const result = { content: undefined } as any;
    const output = formatResult(result);
    expect(output).toEqual([]);
  });

  it("returns text fallback if parts is empty", () => {
    const result = { content: { parts: [] } } as any;
    const output = formatResult(result);
    expect(output).toEqual([]);
  });

  it("returns text fallback if parts has length > 1", () => {
    const result = {
      content: {
        parts: [{ text: "Part 1" }, { text: "Part 2" }],
      },
    } as any;
    const output = formatResult(result);
    expect(output).toEqual([
      { type: "text", text: "Part 1" },
      { type: "text", text: "Part 2" },
    ]);
  });

  it("returns function_use object if parts length = 1 with valid functionCall", () => {
    const argsObj = { foo: 123 };
    const result = {
      content: {
        parts: [
          {
            functionCall: {
              name: "testFunction",
              args: argsObj,
            },
          },
        ],
      },
    } as any;
    const output = formatResult(result);
    expect(output).toEqual([
      {
        functionId: expect.any(String),
        type: "function_use",
        name: "testFunction",
        input: { foo: 123 },
      },
    ]);
  });

  it("returns text if parts length = 1 but no functionCall", () => {
    const result = {
      content: {
        parts: [
          {
            text: "Hello world",
          },
        ],
      },
    } as any;
    const output = formatResult(result);
    expect(output).toEqual([
      {
        type: "text",
        text: "Hello world",
      },
    ]);
  });

  it("returns text if parts length = 1 but functionCall is not an object", () => {
    const result = {
      content: {
        parts: [
          {
            functionCall: "not an object",
            text: "some text",
          },
        ],
      },
    } as any;
    const output = formatResult(result);
    expect(output).toEqual([
      {
        type: "text",
        text: "some text",
      },
    ]);
  });

  it("returns text with empty string if parts length = 1 but text is missing", () => {
    const result = {
      content: {
        parts: [
          {
            functionCall: undefined,
          },
        ],
      },
    } as any;
    const output = formatResult(result);
    expect(output).toEqual([]);
  });

  describe("malformed and edge-case parts", () => {
    it("uses `${id}-${index}` for functionId when id is provided, indexed by part position", () => {
      const result = {
        content: {
          parts: [
            { text: "calling tools" },
            { functionCall: { name: "a", args: {} } },
            { functionCall: { name: "b", args: { x: 1 } } },
          ],
        },
      } as any;
      const output = formatResult(result, "resp-1");
      expect(output).toEqual([
        { type: "text", text: "calling tools" },
        { functionId: "resp-1-1", type: "function_use", name: "a", input: {} },
        {
          functionId: "resp-1-2",
          type: "function_use",
          name: "b",
          input: { x: 1 },
        },
      ]);
    });

    it("falls back to a generated id when id is an empty string", () => {
      const result = {
        content: { parts: [{ functionCall: { name: "a", args: {} } }] },
      } as any;
      const [fn] = formatResult(result, "") as any[];
      expect(fn.functionId).toMatch(/^.+-0$/);
      expect(fn.functionId).not.toBe("-0");
    });

    it("parses JSON-string args into an object", () => {
      const result = {
        content: {
          parts: [{ functionCall: { name: "a", args: '{"city":"Paris"}' } }],
        },
      } as any;
      const [fn] = formatResult(result, "r") as any[];
      expect(fn.input).toEqual({ city: "Paris" });
    });

    it("keeps an empty-string text part", () => {
      const result = { content: { parts: [{ text: "" }] } } as any;
      expect(formatResult(result)).toEqual([{ type: "text", text: "" }]);
    });

    it("prefers text over functionCall when a part has both", () => {
      const result = {
        content: {
          parts: [{ text: "hi", functionCall: { name: "a", args: {} } }],
        },
      } as any;
      expect(formatResult(result, "r")).toEqual([{ type: "text", text: "hi" }]);
    });

    it("skips non-string text values and unknown part types while keeping order", () => {
      const result = {
        content: {
          parts: [
            { text: 42 },
            { inlineData: { mimeType: "image/png", data: "abc" } },
            { thought: true },
            { text: "kept" },
          ],
        },
      } as any;
      expect(formatResult(result)).toEqual([{ type: "text", text: "kept" }]);
    });

    it("treats content without a parts key as empty", () => {
      const result = { content: { role: "model" } } as any;
      expect(formatResult(result)).toEqual([]);
    });

    it("treats null content as empty", () => {
      expect(formatResult({ content: null } as any)).toEqual([]);
    });

    it("treats null result as empty", () => {
      expect(formatResult(null as any)).toEqual([]);
    });

    // Bug (#994): formatResult reads `part.text` without optional chaining
    it.failing("skips a null part instead of throwing", () => {
      const result = {
        content: { parts: [null, { text: "after" }] },
      } as any;
      expect(formatResult(result)).toEqual([{ type: "text", text: "after" }]);
    });

    // Bug (#994): destructuring default only applies to undefined, so `parts: null` crashes on `.length`
    it.failing("treats parts: null as empty instead of throwing", () => {
      const result = { content: { parts: null } } as any;
      expect(formatResult(result)).toEqual([]);
    });
  });
});
