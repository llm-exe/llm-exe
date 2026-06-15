import { createLlmExeError } from "./createLlmExeError";
import { LlmExeError } from "./LlmExeError";

describe("createLlmExeError", () => {
  it("builds an LlmExeError with the definition's code and message", () => {
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: (ctx) =>
          `Unknown parser type ${ctx.parser}. Valid: ${ctx.availableParsers?.join(",")}.`,
      },
      { parser: "weird", availableParsers: ["json", "string"] }
    );

    expect(err).toBeInstanceOf(LlmExeError);
    expect(err.code).toBe("parser.invalid_type");
    expect(err.message).toBe("Unknown parser type weird. Valid: json,string.");
  });

  it("merges static resolution into context", () => {
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: () => "x",
        resolution: "Use a registered parser type.",
      },
      { parser: "weird" }
    );
    expect(err.context?.resolution).toBe("Use a registered parser type.");
  });

  it("merges resolution function into context", () => {
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: () => "x",
        resolution: (ctx) => `Use one of: ${ctx.availableParsers?.join(", ")}.`,
      },
      { parser: "weird", availableParsers: ["json", "string"] }
    );
    expect(err.context?.resolution).toBe("Use one of: json, string.");
  });

  it("adds docsPath and resolves docsUrl with default base", () => {
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: () => "x",
        docsPath: "/parser/included-parsers",
      },
      { parser: "weird" }
    );
    expect(err.context?.docsPath).toBe("/parser/included-parsers");
    expect(err.context?.docsUrl).toBe(
      "https://llm-exe.com/parser/included-parsers"
    );
  });

  it("preserves absolute docs URLs in docsPath", () => {
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: () => "x",
        docsPath: "https://example.com/docs",
      },
      { parser: "weird" }
    );
    expect(err.context?.docsUrl).toBe("https://example.com/docs");
  });

  it("normalizes docs path without leading slash", () => {
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: () => "x",
        docsPath: "parser/included-parsers",
      },
      { parser: "weird" }
    );
    expect(err.context?.docsUrl).toBe(
      "https://llm-exe.com/parser/included-parsers"
    );
  });

  it("propagates cause", () => {
    const root = new Error("root");
    const err = createLlmExeError(
      {
        code: "parser.invalid_type",
        message: () => "x",
      },
      { parser: "weird" },
      { cause: root }
    );
    expect((err as { cause?: unknown }).cause).toBe(root);
  });
});
