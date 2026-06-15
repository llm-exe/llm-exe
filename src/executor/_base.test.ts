import { BaseExecutor } from "@/executor";
import { CoreExecutorHookInput, PlainObject } from "@/interfaces";
import { LlmExeError } from "@/errors";

/**
 * Tests BaseExecutor
 */
describe("llm-exe:executor/BaseExecutor", () => {
  class MockExecutor<I extends PlainObject, O> extends BaseExecutor<I, O> {
    constructor(name = "mock-executor", type = "mock", hooks: CoreExecutorHookInput = {}) {
      super(name, type, {hooks});
    }

    async handler(_input: I) {
      return { result: "Success" };
    }
  }
  class MockExecutorThatThrows<I extends PlainObject, O> extends BaseExecutor<I, O> {
    constructor(name = "mock-executor", type = "mock", hooks: CoreExecutorHookInput = {}) {
      super(name, type, {hooks});
    }

    async handler(_input: I) {
      throw new Error("Something happened")
    }
  }

  it("MockExecutor has basic properties", () => {
    const executor = new MockExecutor();
    expect(executor).toHaveProperty("id");
    expect(executor).toHaveProperty("name");
    expect(executor).toHaveProperty("created");
    expect(executor).toHaveProperty("executions");
    expect(executor).toHaveProperty("hooks");
  });

  it("MockExecutor has basic properties", async () => {
    const executor = new MockExecutor();
    jest.spyOn(executor, "getHandlerInput");
    jest.spyOn(executor, "getHandlerOutput");
    jest.spyOn(executor, "runHook");

    const input = { input: "input-value" };
    await executor.execute(input);

    expect(executor.runHook).toHaveBeenCalledTimes(2);

    expect(executor.getHandlerInput).toHaveBeenCalledWith({
      input: "input-value",
    },  expect.objectContaining({input}), undefined);
    expect(executor.getHandlerOutput).toHaveBeenCalledWith(
      { result: "Success" },
      expect.objectContaining({ input }),
      undefined,
      expect.objectContaining({
        executor: expect.objectContaining({ name: "mock-executor" }),
        execution: expect.objectContaining({ input }),
        attributes: {},
      })
    );
  });

  it("MockExecutor returns correct result from execute", async () => {
    const executor = new MockExecutor();
    const response = await executor.execute({ input: "input-value" });
    expect(response).toEqual({ result: "Success" });
  });

  it("execute throws TypeError when input is null or undefined (issue #410)", async () => {
    const executor = new MockExecutor("named-executor");
    await expect(executor.execute(null as any)).rejects.toThrow(TypeError);
    await expect(executor.execute(null as any)).rejects.toThrow(
      /"named-executor" received null or undefined as input/
    );
    await expect(executor.execute(undefined as any)).rejects.toThrow(TypeError);
    await expect(executor.execute(undefined as any)).rejects.toThrow(
      /"named-executor" received null or undefined as input/
    );
  });

  it("execute still coerces non-null primitives via ensureInputIsObject", async () => {
    // Primitives and arrays are intentionally coerced to { input: value }
    // for compatibility with tool/function callables. Only null/undefined are
    // rejected by the public executor contract.
    // This test locks in that contract.
    const executor = new MockExecutor();
    const response = await executor.execute("a string" as any);
    expect(response).toEqual({ result: "Success" });
  });
  it("MockExecutor can setup hooks", async () => {
    const executor = new MockExecutor("mock-executor", "mock", {
      onComplete(){ console.log("fn1") },
    });
   
    expect(executor.hooks.onComplete).toHaveLength(1);

    executor.setHooks({
      onComplete(){ console.log("fn2") },
    })
    expect(executor.hooks.onComplete).toHaveLength(2);
  });

  it("MockExecutor invalid hooks don't get set", async () => {
    const executor = new MockExecutor("mock-executor", "mock", {
      thisDoesntExist(){} ,
      onComplete: ["not right either"],
    } as any);
   
    expect((executor?.hooks as any)?.thisDoesntExist).toEqual(undefined);
    expect((executor?.hooks as any)?.onComplete).toEqual([]);

    executor.setHooks({
      onComplete(){},
    })
    expect(executor.hooks.onComplete).toHaveLength(1);
  });
  it("MockExecutor invalid hooks don't get set", async () => {
    const executor = new MockExecutor("mock-executor", "mock");
    executor.setHooks(undefined)
    expect(typeof executor.hooks.onComplete).toEqual("object");
    expect(Array.isArray(executor.hooks.onComplete)).toEqual(true);
    expect(typeof executor.hooks.onError).toEqual("object");
    expect(Array.isArray(executor.hooks.onError)).toEqual(true);

  });
  it("MockExecutor invalid hooks don't get set", async () => {
    const executor = new MockExecutorThatThrows("mock-executor", "mock", {
      thisDoesntExist(){} ,
      onComplete: ["not right either"],
    } as any);
    expect(executor.execute({})).rejects.toThrowError("Something happened")
  })
  it("MockExecutor invalid hooks don't get set", async () => {
    const executor = new MockExecutorThatThrows("mock-executor", "mock", {
      thisDoesntExist(){} ,
      onComplete: ["not right either"],
    } as any);

    jest.spyOn(executor, "runHook");
    
    try {
      await executor.execute({})
    } catch (error: any) {
      expect(error.message).toEqual("Something happened")
    } finally {
      expect(executor.runHook).toHaveBeenCalledTimes(2);
      expect(executor.runHook).toHaveBeenNthCalledWith(1, "onError", expect.any(Object));
      expect(executor.runHook).toHaveBeenNthCalledWith(2, "onComplete", expect.any(Object));
    }
  });
  it("MockExecutor can removeHooks", async () => {
    const hooks = {
      onComplete(){},
    }
   const executor = new MockExecutor("mock-executor", "mock", hooks);
   expect(executor.hooks.onComplete).toHaveLength(1);
   executor.removeHook("onComplete", hooks["onComplete"])
   expect(executor.hooks.onComplete).toHaveLength(0);
  });

  it("MockExecutor can removeHooks with invalid hook", async () => {
    const hooks = {
      onComplete(){},
    }
   const executor = new MockExecutor("mock-executor", "mock", hooks);
   expect(executor.hooks.onComplete).toHaveLength(1);
   expect(executor.removeHook("onComplete", hooks["onComplete"].toString() as any)).toBeInstanceOf(MockExecutor)
   expect(executor.hooks.onComplete).toHaveLength(1);
  });
  it("MockExecutor can removeHooks with invalid hook name", async () => {
    const hooks = {
      onComplete(){},
    }
   const executor = new MockExecutor("mock-executor", "mock", hooks);
   expect(executor.hooks.onComplete).toHaveLength(1);
   expect(executor.removeHook("whatIsThisAnyway" as any, hooks["onComplete"])).toBeInstanceOf(MockExecutor)
   expect(executor.hooks.onComplete).toHaveLength(1);
  });


  it("MockExecutor can with off", async () => {
    const hooks = {
      onComplete(){},
    }
   const executor = new MockExecutor("mock-executor", "mock", hooks);
   expect(executor.hooks.onComplete).toHaveLength(1);
   executor.off("onComplete", hooks["onComplete"])
   expect(executor.hooks.onComplete).toHaveLength(0);
  });

  it("MockExecutor can with once", async () => {
    const hooks = {
      onComplete(){},
    }
   const executor = new MockExecutor("mock-executor", "mock");
   expect(executor.hooks.onComplete).toHaveLength(0);
   executor.once("onComplete", hooks["onComplete"]);
   expect(executor.hooks.onComplete).toHaveLength(1);
    await executor.execute({});
   expect(executor.hooks.onComplete).toHaveLength(0);
  });
  it("MockExecutor can with once handles non-function", async () => {
    const hooks = {
      onComplete: ["invalid input"],
    } as any
   const executor = new MockExecutor("mock-executor", "mock");
   expect(executor.hooks.onComplete).toHaveLength(0);
   expect(executor.once("onComplete", hooks["onComplete"])).toBeInstanceOf(MockExecutor)
   expect(executor.hooks.onComplete).toHaveLength(0);
  });

  it("MockExecutor can with on", async () => {
    const hooks = {
      onComplete(){},
    }
   const executor = new MockExecutor("mock-executor", "mock");
   expect(executor.hooks.onComplete).toHaveLength(0);
   executor.on("onComplete", hooks["onComplete"]);
   expect(executor.hooks.onComplete).toHaveLength(1);
    await executor.execute({});
   expect(executor.hooks.onComplete).toHaveLength(1);
  });

  it("MockLlm can use withTraceId", () => {
    const executor = new MockExecutor();
    executor.withTraceId("1234")
    expect(executor.getTraceId()).toEqual("1234");
  });

  describe("Hook Memory Management", () => {
    it("should enforce maximum hooks per event", () => {
      const executor = new MockExecutor();

      // Add hooks up to the limit
      for (let i = 0; i < executor.maxHooksPerEvent; i++) {
        executor.on("onComplete", () => {});
      }

      expect(executor.getHookCount("onComplete")).toBe(executor.maxHooksPerEvent);

      // Try to add one more hook - should throw
      expect(() => {
        executor.on("onComplete", () => {});
      }).toThrow(`Maximum number of hooks (${executor.maxHooksPerEvent}) reached for event "onComplete"`);
    });

    it("throws LlmExeError with executor.hook_limit_reached from setHooks/on", () => {
      const executor = new MockExecutor();
      for (let i = 0; i < executor.maxHooksPerEvent; i++) {
        executor.on("onComplete", () => {});
      }
      try {
        executor.on("onComplete", () => {});
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("executor.hook_limit_reached");
        expect((e as LlmExeError).category).toBe("executor");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("BaseExecutor.setHooks");
        expect(ctx.hook).toBe("onComplete");
        expect(ctx.maxHooksPerEvent).toBe(executor.maxHooksPerEvent);
        expect(ctx.hookCount).toBe(executor.maxHooksPerEvent);
      }
    });

    it("should enforce maximum hooks for once method", () => {
      const executor = new MockExecutor();

      // Add hooks up to the limit
      for (let i = 0; i < executor.maxHooksPerEvent; i++) {
        executor.once("onSuccess", () => {});
      }

      // Try to add one more hook - should throw
      expect(() => {
        executor.once("onSuccess", () => {});
      }).toThrow(`Maximum number of hooks (${executor.maxHooksPerEvent}) reached for event "onSuccess"`);
    });

    it("throws LlmExeError with executor.hook_limit_reached from once", () => {
      const executor = new MockExecutor();
      for (let i = 0; i < executor.maxHooksPerEvent; i++) {
        executor.once("onSuccess", () => {});
      }
      try {
        executor.once("onSuccess", () => {});
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("executor.hook_limit_reached");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("BaseExecutor.once");
        expect(ctx.hook).toBe("onSuccess");
      }
    });

    it("should clear hooks for specific event", () => {
      const executor = new MockExecutor();
      const hook1 = () => {};
      const hook2 = () => {};
      
      executor.on("onComplete", hook1);
      executor.on("onSuccess", hook2);
      
      expect(executor.getHookCount("onComplete")).toBe(1);
      expect(executor.getHookCount("onSuccess")).toBe(1);
      
      executor.clearHooks("onComplete");
      
      expect(executor.getHookCount("onComplete")).toBe(0);
      expect(executor.getHookCount("onSuccess")).toBe(1);
    });

    it("should clear all hooks when no event specified", () => {
      const executor = new MockExecutor();
      
      executor.on("onComplete", () => {});
      executor.on("onSuccess", () => {});
      executor.on("onError", () => {});
      
      const counts = executor.getHookCount() as Record<string, number>;
      expect(counts.onComplete).toBe(1);
      expect(counts.onSuccess).toBe(1);
      expect(counts.onError).toBe(1);
      
      executor.clearHooks();
      
      const clearedCounts = executor.getHookCount() as Record<string, number>;
      expect(clearedCounts.onComplete).toBe(0);
      expect(clearedCounts.onSuccess).toBe(0);
      expect(clearedCounts.onError).toBe(0);
    });

    it("should return correct hook counts", () => {
      const executor = new MockExecutor();
      
      executor.on("onComplete", () => {});
      executor.on("onComplete", () => {});
      executor.on("onSuccess", () => {});
      
      expect(executor.getHookCount("onComplete")).toBe(2);
      expect(executor.getHookCount("onSuccess")).toBe(1);
      expect(executor.getHookCount("onError")).toBe(0);
      
      const allCounts = executor.getHookCount() as Record<string, number>;
      expect(allCounts).toEqual({
        onComplete: 2,
        onSuccess: 1,
        onError: 0
      });
    });

    it("should handle clearing non-existent event gracefully", () => {
      const executor = new MockExecutor();
      
      // Should not throw
      expect(() => {
        executor.clearHooks("nonExistentEvent" as any);
      }).not.toThrow();
    });

    it("should not count duplicate hooks towards limit", () => {
      const executor = new MockExecutor();
      const hook = () => {};
      
      // Add the same hook multiple times
      for (let i = 0; i < 10; i++) {
        executor.on("onComplete", hook);
      }
      
      // Should only count as 1 hook
      expect(executor.getHookCount("onComplete")).toBe(1);
    });

    it("should allow adding hooks after clearing", async () => {
      const executor = new MockExecutor();
      const results: string[] = [];
      
      // Fill up to limit
      for (let i = 0; i < executor.maxHooksPerEvent; i++) {
        executor.on("onComplete", () => results.push(`hook${i}`));
      }
      
      // Clear and add new hooks
      executor.clearHooks("onComplete");
      executor.on("onComplete", () => results.push("new hook"));
      
      await executor.execute({});
      
      expect(results).toContain("new hook");
      expect(results.filter(r => r === "new hook")).toHaveLength(1);
    });

    it("does not console.warn when a hook throws; captures error in onComplete metadata", async () => {
      const executor = new MockExecutor();
      const hookError = new Error("hook failed");
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      let completeMeta: any;

      executor.on("onSuccess", () => {
        throw hookError;
      });
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      const result = await executor.execute({ input: "test" });

      expect(result).toEqual({ result: "Success" });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(completeMeta.hookErrors).toEqual([
        expect.objectContaining({
          hook: "onSuccess",
          errorMessage: "hook failed",
        }),
      ]);

      warnSpy.mockRestore();
    });

    it("captures onError hook failure in onComplete metadata without console.warn", async () => {
      const executor = new MockExecutorThatThrows();
      const hookError = new Error("onError hook failed");
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      let completeMeta: any;

      executor.on("onError", () => {
        throw hookError;
      });
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await expect(executor.execute({})).rejects.toThrow("Something happened");

      expect(warnSpy).not.toHaveBeenCalled();
      expect(completeMeta.hookErrors).toEqual([
        expect.objectContaining({
          hook: "onError",
          errorMessage: "onError hook failed",
        }),
      ]);

      warnSpy.mockRestore();
    });

    it("does not console.warn when onComplete hook throws (failure is lost — known gap until onHookError lands)", async () => {
      const executor = new MockExecutor();
      const hookError = new Error("onComplete hook failed");
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      executor.on("onComplete", () => {
        throw hookError;
      });

      // The execution itself still resolves successfully.
      await expect(executor.execute({ input: "test" })).resolves.toEqual({
        result: "Success",
      });

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should properly handle once wrapper removal", async () => {
      const executor = new MockExecutor();
      let callCount = 0;

      executor.once("onComplete", () => callCount++);

      expect(executor.getHookCount("onComplete")).toBe(1);

      await executor.execute({});
      expect(callCount).toBe(1);
      expect(executor.getHookCount("onComplete")).toBe(0);

      await executor.execute({});
      expect(callCount).toBe(1); // Should not increment again
    });

    it("should initialize hooks array when once is called for uninitialized event", () => {
      const executor = new MockExecutor();
      // Manually delete an event's hooks array to simulate uninitialized state
      delete executor.hooks.onSuccess;
      expect(executor.hooks.onSuccess).toBeUndefined();

      executor.once("onSuccess", () => {});

      // The hooks array should have been created and the hook added
      expect(executor.hooks.onSuccess).toHaveLength(1);
    });
  });

  describe("structured error metadata on caught errors", () => {
    class FailingExecutor extends BaseExecutor<PlainObject> {
      constructor(private err: unknown) {
        super("failing", "mock");
      }
      async handler() {
        throw this.err;
      }
    }

    it("populates errorCategory/errorCode/errorContext/errorCause for LlmExeError", async () => {
      const root = new Error("root");
      const llmErr = new LlmExeError("boom", {
        code: "parser.invalid_type",
        context: { operation: "x", parser: "weird" },
        cause: root,
      });
      const executor = new FailingExecutor(llmErr);
      let completeMeta: any;
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await expect(executor.execute({})).rejects.toBe(llmErr);

      expect(completeMeta.error).toBe(llmErr);
      expect(completeMeta.errorMessage).toBe("boom");
      expect(completeMeta.errorCategory).toBe("parser");
      expect(completeMeta.errorCode).toBe("parser.invalid_type");
      expect(completeMeta.errorContext).toEqual({
        operation: "x",
        parser: "weird",
      });
      expect(completeMeta.errorCause).toBe(root);
    });

    it("preserves error/errorMessage and leaves structured fields undefined for plain Error", async () => {
      const plainErr = new Error("plain");
      const executor = new FailingExecutor(plainErr);
      let completeMeta: any;
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await expect(executor.execute({})).rejects.toBe(plainErr);

      expect(completeMeta.error).toBe(plainErr);
      expect(completeMeta.errorMessage).toBe("plain");
      expect(completeMeta.errorCategory).toBeUndefined();
      expect(completeMeta.errorCode).toBeUndefined();
      expect(completeMeta.errorContext).toBeUndefined();
      expect(completeMeta.errorCause).toBeUndefined();
    });
  });

  describe("hookErrors metadata field", () => {
    class MockExec extends BaseExecutor<PlainObject> {
      constructor() {
        super("mock", "mock");
      }
      async handler() {
        return { ok: true };
      }
    }

    it("captures structured fields from a hook that throws an LlmExeError", async () => {
      const executor = new MockExec();
      const hookErr = new LlmExeError("hook boom", {
        code: "executor.hook_failed",
        context: { hook: "onSuccess" },
      });
      executor.on("onSuccess", () => {
        throw hookErr;
      });
      let completeMeta: any;
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await executor.execute({});

      expect(completeMeta.hookErrors).toEqual([
        expect.objectContaining({
          hook: "onSuccess",
          errorMessage: "hook boom",
          errorCategory: "executor",
          errorCode: "executor.hook_failed",
          errorContext: { hook: "onSuccess" },
        }),
      ]);
    });

    it("accumulates multiple hook errors in order", async () => {
      const executor = new MockExec();
      executor.on("onSuccess", () => {
        throw new Error("first");
      });
      executor.on("onSuccess", () => {
        throw new Error("second");
      });
      let completeMeta: any;
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await executor.execute({});

      expect(completeMeta.hookErrors).toHaveLength(2);
      expect(completeMeta.hookErrors[0].errorMessage).toBe("first");
      expect(completeMeta.hookErrors[1].errorMessage).toBe("second");
    });

    it("preserves the raw error on the record so plain Error stack/name survive", async () => {
      const executor = new MockExec();
      const raw = new TypeError("typed boom");
      executor.on("onSuccess", () => {
        throw raw;
      });
      let completeMeta: any;
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await executor.execute({});

      const record = completeMeta.hookErrors[0];
      expect(record.error).toBe(raw);
      expect(record.error).toBeInstanceOf(TypeError);
      expect((record.error as Error).stack).toBeDefined();
      expect((record.error as Error).name).toBe("TypeError");
    });

    it("preserves raw non-Error throws (strings, objects)", async () => {
      const executor = new MockExec();
      executor.on("onSuccess", () => {
        throw "string thrown";
      });
      let completeMeta: any;
      executor.on("onComplete", (meta) => {
        completeMeta = meta;
      });

      await executor.execute({});

      expect(completeMeta.hookErrors[0].error).toBe("string thrown");
      expect(completeMeta.hookErrors[0].errorMessage).toBe("string thrown");
    });
  });

  describe("once() listener cleanup", () => {
    class MockExec extends BaseExecutor<PlainObject> {
      constructor() {
        super("mock", "mock");
      }
      async handler() {
        return { ok: true };
      }
    }

    it("removes the once wrapper even when the callback throws", async () => {
      const executor = new MockExec();
      let calls = 0;
      executor.once("onSuccess", () => {
        calls++;
        throw new Error("once boom");
      });

      expect(executor.getHookCount("onSuccess")).toBe(1);

      await executor.execute({});
      // Wrapper should have self-removed despite the throw.
      expect(executor.getHookCount("onSuccess")).toBe(0);
      expect(calls).toBe(1);

      // Subsequent executions must not re-fire the throwing callback.
      await executor.execute({});
      expect(calls).toBe(1);
    });
  });

});
