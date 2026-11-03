import { LlmExeError } from "@/errors";
import { LlmFunctionParser } from "./LlmNativeFunctionParser";
import { StringParser } from "./StringParser";

function thrownBy(fn: () => unknown): LlmExeError {
  try {
    fn();
  } catch (e) {
    return e as LlmExeError;
  }
  throw new Error("Expected an error to be thrown");
}

describe("LlmFunctionParser", () => {
  const parser = new LlmFunctionParser({ parser: new StringParser() });

  it("throws a coded parser error when the response has no content blocks", () => {
    const err = thrownBy(() => parser.parse({ content: [] } as any));

    expect(err).toBeInstanceOf(LlmExeError);
    expect(err.code).toBe("parser.parse_failed");
    expect((err.context as Record<string, unknown>).reason).toBe("empty_content");
  });

  it("throws a coded parser error when the response has no content field", () => {
    const err = thrownBy(() => parser.parse({} as any));

    expect(err).toBeInstanceOf(LlmExeError);
    expect(err.code).toBe("parser.parse_failed");
  });
});
