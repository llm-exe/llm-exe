import { isEmpty } from "@/utils/modules/isEmpty";
import { isPromise } from "@/utils/modules/isPromise";
import { appendContextPath } from "@/utils/modules/handlebars/utils/appendContextPath";
import { blockParams } from "@/utils/modules/handlebars/utils/blockParams";
import { createFrame } from "@/utils/modules/handlebars/utils/createFrame";
import { withFnAsync } from "@/utils/modules/handlebars/helpers/async/with";
import { LlmExeError } from "@/errors";

jest.mock("@/utils/modules/isEmpty");
jest.mock("@/utils/modules/isPromise");
jest.mock("@/utils/modules/handlebars/utils/appendContextPath");
jest.mock("@/utils/modules/handlebars/utils/blockParams");
jest.mock("@/utils/modules/handlebars/utils/createFrame");

describe("withFnAsync", () => {
  const isEmptyMock = isEmpty as unknown as jest.Mock;
  const isPromiseMock = isPromise as unknown as jest.Mock;
  const appendContextPathMock = appendContextPath as jest.Mock;
  const blockParamsMock = blockParams as jest.Mock;
  const createFrameMock = createFrame as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    isEmptyMock.mockReturnValue(false);
    isPromiseMock.mockReturnValue(false);
  });

  it("should throw when called with incorrect number of arguments", async () => {
    await expect((withFnAsync as any).call({})).rejects.toThrow(
      "#with requires exactly one argument"
    );
  });

  it("throws LlmExeError with template.invalid_helper_arguments on wrong arg count", async () => {
    try {
      await (withFnAsync as any).call({});
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("template.invalid_helper_arguments");
      expect((e as LlmExeError).category).toBe("template");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("handlebars.asyncHelper.with");
      expect(ctx.helper).toBe("with");
    }
  });

  it("should render fn with context when context is not empty", async () => {
    const context = { name: "test" };
    const options = {
      fn: jest.fn().mockReturnValue("fn result"),
      inverse: jest.fn().mockReturnValue("inverse result"),
      data: null,
      ids: null,
    };

    const result = await withFnAsync.call({}, context, options);
    expect(result).toBe("fn result");
    expect(options.fn).toHaveBeenCalledWith(context, {
      data: null,
      blockParams: undefined,
    });
  });

  it("should render inverse when context is empty", async () => {
    isEmptyMock.mockReturnValue(true);
    const thisArg = { key: "value" };
    const options = {
      fn: jest.fn().mockReturnValue("fn result"),
      inverse: jest.fn().mockReturnValue("inverse result"),
      data: null,
      ids: null,
    };

    const result = await withFnAsync.call(thisArg, null, options);
    expect(result).toBe("inverse result");
    expect(options.inverse).toHaveBeenCalledWith(thisArg);
    expect(options.fn).not.toHaveBeenCalled();
  });

  it("should await promise context", async () => {
    isPromiseMock.mockReturnValue(true);
    const resolved = { name: "resolved" };
    const context = Promise.resolve(resolved);
    const options = {
      fn: jest.fn().mockReturnValue("fn result"),
      inverse: jest.fn().mockReturnValue("inverse result"),
      data: null,
      ids: null,
    };

    const result = await withFnAsync.call({}, context, options);
    expect(isPromiseMock).toHaveBeenCalledWith(context);
    expect(result).toBe("fn result");
  });

  it("should call function context", async () => {
    const contextFn = jest.fn().mockReturnValue({ name: "called" });
    const options = {
      fn: jest.fn().mockReturnValue("fn result"),
      inverse: jest.fn().mockReturnValue("inverse result"),
      data: null,
      ids: null,
    };

    const result = await withFnAsync.call({}, contextFn, options);
    expect(contextFn).toHaveBeenCalled();
    expect(result).toBe("fn result");
  });

  it("should set up data and contextPath when options.data and options.ids are provided", async () => {
    const context = { name: "test" };
    const frameData = { root: {} };
    createFrameMock.mockReturnValue(frameData);
    appendContextPathMock.mockReturnValue("root.ctx");
    blockParamsMock.mockReturnValue([context, "root.ctx"]);

    const options = {
      fn: jest.fn().mockReturnValue("fn result"),
      inverse: jest.fn().mockReturnValue("inverse result"),
      data: { contextPath: "root" },
      ids: ["ctx"],
    };

    const result = await withFnAsync.call({}, context, options);
    expect(result).toBe("fn result");
    expect(createFrameMock).toHaveBeenCalledWith(options.data);
    expect(appendContextPathMock).toHaveBeenCalledWith("root", "ctx");
    expect(blockParamsMock).toHaveBeenCalledWith([context], ["root.ctx"]);
    expect(options.fn).toHaveBeenCalledWith(context, {
      data: { root: {}, contextPath: "root.ctx" },
      blockParams: [context, "root.ctx"],
    });
  });

  it("should pass data without contextPath when ids are not provided", async () => {
    const context = { name: "test" };
    blockParamsMock.mockReturnValue(["block", "params"]);
    const options = {
      fn: jest.fn().mockReturnValue("fn result"),
      inverse: jest.fn().mockReturnValue("inverse result"),
      data: { root: {} },
      ids: null,
    };

    const result = await withFnAsync.call({}, context, options);
    expect(result).toBe("fn result");
    expect(createFrameMock).not.toHaveBeenCalled();
    expect(blockParamsMock).toHaveBeenCalledWith([context], [undefined]);
    expect(options.fn).toHaveBeenCalledWith(context, {
      data: { root: {} },
      blockParams: ["block", "params"],
    });
  });
});
