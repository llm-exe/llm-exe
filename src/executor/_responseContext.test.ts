import { attachResponseContext } from "./_responseContext";
import { LlmExeError } from "@/errors";
import { BaseLlmOutput } from "@/llm/output/base";

const usage = {
  input_tokens: 120,
  output_tokens: 8,
  total_tokens: 128,
  cache_read_input_tokens: 100,
  cache_creation_input_tokens: 20,
};

function mockCall(overrides: Record<string, any> = {}) {
  return BaseLlmOutput({
    stopReason: "length",
    usage,
    content: [{ type: "text", text: "{" }],
    ...overrides,
  }) as any;
}

describe("llm-exe:executor attachResponseContext", () => {
  it("attaches usage and stopReason to a parser failure", () => {
    const error = new LlmExeError("Failed to parse", {
      code: "parser.parse_failed",
      context: { parser: "json", reason: "invalid_json" },
    });

    const result = attachResponseContext(error, mockCall());

    expect(result).toBe(error);
    expect(result.code).toEqual("parser.parse_failed");
    expect(result.context).toEqual({
      parser: "json",
      reason: "invalid_json",
      usage,
      stopReason: "length",
    });
  });

  it("preserves cache read/write details on the normalized usage", () => {
    const error = new LlmExeError("Failed to parse", {
      code: "parser.parse_failed",
      context: {},
    });

    const result = attachResponseContext(error, mockCall());

    expect(result.context?.usage?.cache_read_input_tokens).toEqual(100);
    expect(result.context?.usage?.cache_creation_input_tokens).toEqual(20);
  });

  it("enriches invalid_input and schema_validation_failed", () => {
    const invalidInput = attachResponseContext(
      new LlmExeError("bad input", { code: "parser.invalid_input" }),
      mockCall()
    );
    const schema = attachResponseContext(
      new LlmExeError("bad schema", {
        code: "parser.schema_validation_failed",
      }),
      mockCall()
    );

    expect(invalidInput.context?.stopReason).toEqual("length");
    expect(schema.context?.stopReason).toEqual("length");
  });

  it("uses the provider's actual stopReason, not a hard-coded value", () => {
    const error = attachResponseContext(
      new LlmExeError("Failed to parse", { code: "parser.parse_failed" }),
      mockCall({ stopReason: "max_tokens" })
    );

    expect(error.context?.stopReason).toEqual("max_tokens");
  });

  it("does not overwrite existing context values", () => {
    const error = new LlmExeError("Failed to parse", {
      code: "parser.parse_failed",
      context: { stopReason: "already-set" },
    });

    attachResponseContext(error, mockCall());

    expect(error.context?.stopReason).toEqual("already-set");
    expect(error.context?.usage).toEqual(usage);
  });

  it("leaves unrelated llm-exe errors untouched", () => {
    const error = new LlmExeError("Missing prompt", {
      code: "executor.missing_prompt",
      context: { executorName: "test" },
    });

    attachResponseContext(error, mockCall());

    expect(error.context).toEqual({ executorName: "test" });
  });

  it("leaves non llm-exe errors untouched", () => {
    const error = new TypeError("nope");
    expect(attachResponseContext(error, mockCall())).toBe(error);
    expect((error as any).context).toBeUndefined();
  });

  it("attaches nothing when there is no readable response", () => {
    const error = new LlmExeError("Failed to parse", {
      code: "parser.parse_failed",
      context: { parser: "json" },
    });

    attachResponseContext(error, undefined as any);
    attachResponseContext(error, {} as any);
    attachResponseContext(error, {
      getResult: () => {
        throw new Error("unreadable");
      },
    } as any);

    expect(error.context).toEqual({ parser: "json" });
  });

  it("omits empty stopReason and non-object usage", () => {
    const error = new LlmExeError("Failed to parse", {
      code: "parser.parse_failed",
    });

    attachResponseContext(error, {
      getResult: () => ({ stopReason: "", usage: undefined }),
    } as any);

    expect(error.context).toBeUndefined();
  });
});
