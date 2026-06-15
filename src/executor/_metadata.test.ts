import { ExecutorExecutionMetadataState, createMetadataState } from "@/executor/_metadata";


/**
 * Tests CoreExecutor
 */
describe("llm-exe:executor/ExecutorExecutionMetadataState", () => {
  it("createMetadataState", () => {
    const metadata = createMetadataState();
    expect(metadata).toBeInstanceOf(ExecutorExecutionMetadataState);
  });

  it("has basic properties", () => {
    const metadata = new ExecutorExecutionMetadataState();
    expect(metadata).toHaveProperty("setItem");
    expect(metadata).toHaveProperty("asPlainObject");
    expect(Object.keys(metadata).length).toEqual(0);
  });
  it("has basic properties with defaults", () => {
    const start = new Date().getTime()
    const metadata = new ExecutorExecutionMetadataState({ start, "input": "hi"});
    const result = metadata.asPlainObject()
    expect(result).toHaveProperty("start");
    expect(result).toHaveProperty("input");
    expect(result.input).toEqual("hi");
    expect(result.start).toEqual(start);
  });
  it("setItem", () => {
    const metadata = new ExecutorExecutionMetadataState();
    metadata.setItem({"input": "hi"})
    const result = metadata.asPlainObject()
    expect(result).toHaveProperty("input");
    expect(result.input).toEqual("hi");
  });
  it("setItem invalid item", () => {
    const metadata = new ExecutorExecutionMetadataState();
    metadata.setItem("" as any)
    metadata.setItem("yo" as any)
    const result = metadata.asPlainObject()
    expect(result.input).toEqual(undefined);

    metadata.setItem(["yo"] as any)
    const result2 = metadata.asPlainObject()
    expect(result2.input).toEqual(undefined);

  });

  it("asPlainObject returns frozen object", () => {
    const metadata = new ExecutorExecutionMetadataState();
    metadata.setItem({ input: "test" });
    const result = metadata.asPlainObject();
    expect(Object.isFrozen(result)).toBe(true);
    expect(() => {
      (result as any).input = "modified";
    }).toThrow();
  });

  it("asPlainObject includes all expected keys", () => {
    const metadata = new ExecutorExecutionMetadataState();
    const result = metadata.asPlainObject();
    const expectedKeys = [
      "start", "end", "input", "handlerInput",
      "handlerOutput", "output", "errorMessage", "error",
      "errorCategory", "errorCode", "errorContext", "errorCause",
      "hookErrors", "metadata",
    ];
    expect(Object.keys(result).sort()).toEqual(expectedKeys.sort());
  });

  it("setItem is chainable", () => {
    const metadata = new ExecutorExecutionMetadataState();
    const returned = metadata.setItem({ input: "test" });
    expect(returned).toBe(metadata);
  });

  it("setItem overwrites previous values", () => {
    const metadata = new ExecutorExecutionMetadataState();
    metadata.setItem({ input: "first" });
    metadata.setItem({ input: "second" });
    expect(metadata.asPlainObject().input).toEqual("second");
  });

  it("setItem sets multiple fields at once", () => {
    const now = Date.now();
    const metadata = new ExecutorExecutionMetadataState();
    metadata.setItem({
      start: now,
      end: now + 100,
      input: "hello",
      output: "world",
      errorMessage: "oops",
    });
    const result = metadata.asPlainObject();
    expect(result.start).toEqual(now);
    expect(result.end).toEqual(now + 100);
    expect(result.input).toEqual("hello");
    expect(result.output).toEqual("world");
    expect(result.errorMessage).toEqual("oops");
  });

  it("setItem with null values", () => {
    const metadata = new ExecutorExecutionMetadataState();
    metadata.setItem({ input: null as any, error: null as any });
    const result = metadata.asPlainObject();
    expect(result.input).toBeNull();
    expect(result.error).toBeNull();
  });

  it("createMetadataState with initial items", () => {
    const now = Date.now();
    const metadata = createMetadataState({ start: now, input: "init" });
    const result = metadata.asPlainObject();
    expect(result.start).toEqual(now);
    expect(result.input).toEqual("init");
  });

  it("default state values are correct", () => {
    const metadata = new ExecutorExecutionMetadataState();
    const result = metadata.asPlainObject();
    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
    expect(result.input).toBeUndefined();
    expect(result.handlerInput).toBeUndefined();
    expect(result.handlerOutput).toBeUndefined();
    expect(result.output).toBeUndefined();
    expect(result.errorMessage).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(result.metadata).toBeNull();
  });

  it("metadata field can store arbitrary data", () => {
    const metadata = new ExecutorExecutionMetadataState();
    const meta = { tokens: 150, model: "gpt-4", latency: 230 };
    metadata.setItem({ metadata: meta } as any);
    const result = metadata.asPlainObject();
    expect(result.metadata).toEqual(meta);
  });
});
