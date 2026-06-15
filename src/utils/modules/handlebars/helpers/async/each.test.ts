import { eachFnAsync } from "@/utils/modules/handlebars/helpers/async/each";
import { LlmExeError } from "@/errors";

describe("eachFnAsync", () => {
  it("throws when called without options (the iterator)", async () => {
    await expect((eachFnAsync as any).call({}, [])).rejects.toThrow(
      "Must pass iterator to #each"
    );
  });

  it("throws LlmExeError with template.invalid_helper_arguments when options missing", async () => {
    try {
      await (eachFnAsync as any).call({}, []);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("template.invalid_helper_arguments");
      expect((e as LlmExeError).category).toBe("template");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("handlebars.asyncHelper.each");
      expect(ctx.helper).toBe("each");
      expect(ctx.expected).toBe("an iterator");
    }
  });

  it("iterates over array values calling fn for each item", async () => {
    const fn = jest.fn(async (item: any) => `[${item}]`);
    const inverse = jest.fn(() => "");
    const result = await eachFnAsync.call(
      {},
      ["a", "b", "c"],
      { fn, inverse, data: undefined, ids: undefined }
    );
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toBe("[a][b][c]");
  });

  it("renders inverse when the iterator is empty", async () => {
    const fn = jest.fn();
    const inverse = jest.fn(() => "empty");
    const result = await eachFnAsync.call(
      {},
      [],
      { fn, inverse, data: undefined, ids: undefined }
    );
    expect(fn).not.toHaveBeenCalled();
    expect(result).toBe("empty");
  });
});