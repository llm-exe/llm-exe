import { apiRequestWrapper } from "@/utils/modules/requestWrapper";
import { _resetDeprecationWarnings } from "@/llm/_utils.deprecationWarning";
import { Config, ExecutionContext } from "@/types";

/**
 * Verifies the wrapper's ExecutionContext / deprecation-warning wiring:
 * - emit fires on first call(), not at construction
 * - context.executor.name + context.traceId are propagated to the warning
 * - context.traceId takes precedence over the wrapper's own traceId
 * - dedupe is per-shorthand
 */
describe("apiRequestWrapper: ExecutionContext + deprecation wiring", () => {
  let warningSpy: jest.SpyInstance;

  function deprecatedConfig(
    shorthand: string,
    extras: Partial<Config<any>> = {}
  ): Config<any> {
    return {
      key: "google.chat.v1",
      provider: "google.chat",
      method: "POST",
      endpoint: "",
      headers: "{}",
      options: { model: { default: "gemini-2.5-pro" } } as any,
      mapBody: {},
      transformResponse: () => ({} as any),
      deprecated: { shorthand, message: `${shorthand} is deprecated` },
      ...extras,
    };
  }

  function makeWrapper(config: Config<any>, options: Record<string, any> = {}) {
    const handler = jest
      .fn()
      .mockResolvedValue({ getResultText: () => "ok" });
    return {
      handler,
      wrapper: apiRequestWrapper(config, options, handler as any),
    };
  }

  beforeEach(() => {
    _resetDeprecationWarnings();
    warningSpy = jest.spyOn(process, "emitWarning").mockImplementation();
  });

  afterEach(() => {
    warningSpy.mockRestore();
  });

  it("does not emit at construction", () => {
    makeWrapper(deprecatedConfig("google.gemini-2.5-pro"));
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("emits on first call() with executor name and traceId from context", async () => {
    const { wrapper } = makeWrapper(deprecatedConfig("google.gemini-2.5-pro"));
    const context: ExecutionContext = {
      traceId: "trace-from-executor",
      executor: {
        id: "exec-id",
        type: "llm-executor",
        name: "summarizer",
        created: 0,
        executions: 1,
      },
      execution: { start: 0, end: null, input: {} },
      attributes: {},
    };

    await wrapper.call({} as any, undefined, context);

    expect(warningSpy).toHaveBeenCalledTimes(1);
    const detail = JSON.parse(warningSpy.mock.calls[0][1].detail);
    expect(detail.executorName).toBe("summarizer");
    expect(detail.traceId).toBe("trace-from-executor");
    expect(detail.shorthand).toBe("google.gemini-2.5-pro");
    expect(detail.model).toBe("gemini-2.5-pro");
    expect(detail.provider).toBe("google.chat");
  });

  it("falls back to wrapper's own traceId when context has none", async () => {
    const { wrapper } = makeWrapper(
      deprecatedConfig("google.gemini-2.5-pro"),
      { traceId: "llm-trace" }
    );
    await wrapper.call({} as any, undefined, {
      executor: {
        id: "x",
        type: "t",
        name: "n",
        created: 0,
        executions: 1,
      },
      execution: { start: 0, end: null, input: {} },
      attributes: {},
    });
    const detail = JSON.parse(warningSpy.mock.calls[0][1].detail);
    expect(detail.traceId).toBe("llm-trace");
  });

  it("dedupes per-shorthand across multiple calls", async () => {
    const { wrapper } = makeWrapper(deprecatedConfig("google.gemini-2.5-pro"));
    await wrapper.call({} as any);
    await wrapper.call({} as any);
    await wrapper.call({} as any);
    expect(warningSpy).toHaveBeenCalledTimes(1);
  });

  it("does not emit when config is not deprecated", async () => {
    const config: Config<any> = {
      key: "google.chat.v1",
      provider: "google.chat",
      method: "POST",
      endpoint: "",
      headers: "{}",
      options: {},
      mapBody: {},
      transformResponse: () => ({} as any),
    };
    const { wrapper } = makeWrapper(config);
    await wrapper.call({} as any);
    expect(warningSpy).not.toHaveBeenCalled();
  });
});
