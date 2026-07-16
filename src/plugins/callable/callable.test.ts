import { useExecutors } from "@/plugins/callable";
import {
  CallableExecutor,
  UseExecutorsBase,
} from "@/plugins/callable/callable";
import { LlmExeError } from "@/errors";

const callableFnConfig = {
  key: "get_appointments",
  name: "get_appointments",
  description: "Used to get appointments.",
  input: `Must be JSON: ${JSON.stringify({ accountId: "12345" })}`,
  handler: async (_input: any) => {
    return "Hello world";
  },
};
const callableFn = new CallableExecutor(callableFnConfig);

describe("llm-exe:callable/useExecutors", () => {
  it("CallableExecutor throws is invalid handler", () => {
    const executors = useExecutors([]);
    expect(executors).toBeInstanceOf(UseExecutorsBase);
  });
  it("CallableExecutor throws is invalid handler", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.handlers).toHaveLength(1);
    expect(executors).toHaveProperty("hasFunction");
    expect(typeof executors.hasFunction).toEqual("function");
    expect(executors).toHaveProperty("getFunction");
    expect(typeof executors.getFunction).toEqual("function");
    expect(executors).toHaveProperty("getFunctions");
    expect(typeof executors.getFunctions).toEqual("function");
    expect(executors).toHaveProperty("getVisibleFunctions");
    expect(typeof executors.getVisibleFunctions).toEqual("function");
    expect(executors).toHaveProperty("callFunction");
    expect(typeof executors.callFunction).toEqual("function");
  });
  it("CallableExecutor hasFunction will be true if exists", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.hasFunction("get_appointments")).toEqual(true);
  });

  it("CallableExecutor hasFunction will be true if exists if created from object", () => {
    const executors = useExecutors([callableFnConfig]);
    expect(executors.hasFunction("get_appointments")).toEqual(true);
  });

  it("CallableExecutor hasFunction will be false if not exists", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.hasFunction("does_not_exist")).toEqual(false);
  });
  it("CallableExecutor hasFunction will be false if undefined", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.hasFunction(undefined as any)).toEqual(false);
  });

  it("CallableExecutor getFunction will be true if exists", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.getFunction("get_appointments")).toBeInstanceOf(
      CallableExecutor
    );
  });
  it("CallableExecutor getFunction will be false if not exists", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.getFunction("does_not_exist")).toEqual(undefined);
  });
  it("CallableExecutor getFunction will be false if undefined", () => {
    const executors = useExecutors([callableFn]);
    expect(executors.getFunction(undefined as any)).toEqual(undefined);
  });

  it("CallableExecutor getFunction will be false if undefined", () => {
    const executors = useExecutors([callableFn]);
    const visible = executors.getVisibleFunctions({});
    expect(visible).toHaveLength(1);
  });

  it("CallableExecutor getFunction will be false if undefined", async () => {
    const executors = useExecutors([callableFn]);
    const result = await executors.callFunction("get_appointments", "Hello");
    expect(result).toEqual({ result: "Hello world", attributes: {} });
  });

  it("CallableExecutor propagates handler errors from callFunction", async () => {
    const callableFn1 = new CallableExecutor({
      key: "get_appointments",
      name: "get_appointments",
      description: "Used to get appointments.",
      input: `Must be JSON: ${JSON.stringify({ accountId: "12345" })}`,
      handler: async (_input: any) => {
        throw new Error("Error from callable");
      },
    });
    const executors = useExecutors([callableFn1]);
    await expect(
      executors.callFunction("get_appointments", "Hello")
    ).rejects.toThrow("Error from callable");
  });

  it("CallableExecutor validateFunctionInput true if undefined", async () => {
    const executors = useExecutors([
      new CallableExecutor({
        key: "get_appointments",
        name: "get_appointments",
        description: "Used to get appointments.",
        input: `Must be JSON: ${JSON.stringify({ accountId: "12345" })}`,
        handler: async (_input: any) => {
          return "Hello world";
        },
      }),
    ]);
    const result = await executors.validateFunctionInput(
      "get_appointments",
      "Hello"
    );
    expect(result).toEqual({ result: true, attributes: {} });
  });

  it("CallableExecutor validateFunctionInput ", async () => {
    const executors = useExecutors([
      new CallableExecutor({
        key: "get_appointments",
        name: "get_appointments",
        description: "Used to get appointments.",
        input: `Must be JSON: ${JSON.stringify({ accountId: "12345" })}`,
        handler: async (_input: any) => {
          return "Hello world";
        },
        validateInput: async (_input: any) => {
          return { result: true, attributes: { hello: "world" } };
        },
      }),
    ]);
    const result = await executors.validateFunctionInput(
      "get_appointments",
      "Hello"
    );
    expect(result).toEqual({ result: true, attributes: { hello: "world" } });
  });

  it("CallableExecutor validateFunctionInput returns error message if throws", async () => {
    const executors = useExecutors([
      new CallableExecutor({
        key: "get_appointments",
        name: "get_appointments",
        description: "Used to get appointments.",
        input: `Must be JSON: ${JSON.stringify({ accountId: "12345" })}`,
        handler: async (_input: any) => {
          return "Hello world";
        },
        validateInput: async () => {
          throw new Error("validateInput threw an error!");
        },
      }),
    ]);
    const result = await executors.validateFunctionInput(
      "get_appointments",
      "Hello"
    );
    expect(result).toEqual({
      result: false,
      attributes: { error: "validateInput threw an error!" },
    });
  });

  it("CallableExecutor validateFunctionInput returns error message if throws", async () => {
    const executors = useExecutors([
      new CallableExecutor({
        key: "get_appointments",
        name: "get_appointments",
        description: "Used to get appointments.",
        input: `Must be JSON: ${JSON.stringify({ accountId: "12345" })}`,
        handler: async (_input: any) => {
          return "Hello world";
        },
        validateInput: async (_input: any) => {
          throw new Error("validateInput threw an error!");
        },
      }),
    ]);
    const result = await executors.validateFunctionInput(
      "invalid_name",
      "Hello"
    );
    expect(result).toEqual({
      result: false,
      attributes: {
        error: "[invalid handler] The handler (invalid_name) does not exist.",
      },
    });
  });

  describe("getVisibleFunctions with visibility filtering", () => {
    it("filters out executors whose visibilityHandler returns false", () => {
      const visible = new CallableExecutor({
        name: "visible_fn",
        description: "Always visible",
        input: "{}",
        handler: async () => "visible",
        visibilityHandler: () => true,
      });
      const hidden = new CallableExecutor({
        name: "hidden_fn",
        description: "Always hidden",
        input: "{}",
        handler: async () => "hidden",
        visibilityHandler: () => false,
      });
      const executors = useExecutors([visible, hidden]);
      const result = executors.getVisibleFunctions({});
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual("visible_fn");
    });

    it("passes input and attributes to visibilityHandler", () => {
      const visibilityHandler = jest.fn().mockReturnValue(true);
      const callable = new CallableExecutor({
        name: "check_fn",
        description: "Checks args",
        input: "{}",
        handler: async () => "ok",
        visibilityHandler,
      });
      const executors = useExecutors([callable]);
      const input = { userId: "123" };
      const attrs = { role: "admin" };
      executors.getVisibleFunctions(input, attrs);
      expect(visibilityHandler).toHaveBeenCalledWith(
        input,
        expect.any(Object),
        attrs
      );
    });

    it("includes executors with no visibilityHandler", () => {
      const withHandler = new CallableExecutor({
        name: "with_handler",
        description: "Has visibility",
        input: "{}",
        handler: async () => "a",
        visibilityHandler: () => true,
      });
      const withoutHandler = new CallableExecutor({
        name: "without_handler",
        description: "No visibility handler",
        input: "{}",
        handler: async () => "b",
      });
      const executors = useExecutors([withHandler, withoutHandler]);
      const result = executors.getVisibleFunctions({});
      expect(result).toHaveLength(2);
    });
  });

  describe("callFunction with non-existent handler", () => {
    it("throws a typed handler_not_found error when handler does not exist", async () => {
      const executors = useExecutors([callableFn]);
      try {
        await executors.callFunction("non_existent", "{}");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("callable.handler_not_found");
        expect((e as Error).message).toBe(
          "[invalid handler] The handler (non_existent) does not exist."
        );
      }
    });
  });

  describe("callFunction authorization gates", () => {
    it("refuses to call a handler hidden by its visibilityHandler, using the same not-found error", async () => {
      const hidden = new CallableExecutor({
        name: "hidden_fn",
        description: "Always hidden",
        input: "{}",
        handler: async () => "should never run",
        visibilityHandler: () => false,
      });
      const executors = useExecutors([hidden]);
      try {
        await executors.callFunction("hidden_fn", "{}");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("callable.handler_not_found");
        // Identical message to a genuinely missing handler — callers must not
        // be able to distinguish hidden from nonexistent.
        expect((e as Error).message).toBe(
          "[invalid handler] The handler (hidden_fn) does not exist."
        );
        const ctx = (e as LlmExeError).context as Record<string, any>;
        expect(ctx.availableFunctions).not.toContain("hidden_fn");
      }
    });

    it("passes input and attributes through to the visibilityHandler", async () => {
      const visibilityHandler = jest.fn().mockReturnValue(true);
      const callable = new CallableExecutor({
        name: "gated_fn",
        description: "Gated",
        input: "{}",
        handler: async () => "ok",
        visibilityHandler,
      });
      const executors = useExecutors([callable]);
      const attrs = { role: "admin" };
      await executors.callFunction("gated_fn", "payload", attrs);
      expect(visibilityHandler).toHaveBeenCalledWith(
        "payload",
        expect.any(Object),
        attrs
      );
    });

    it("throws validation_failed when the handler's validateInput rejects the input", async () => {
      const handler = jest.fn(async () => "should never run");
      const callable = new CallableExecutor({
        name: "validated_fn",
        description: "Validates input",
        input: "{}",
        handler,
        validateInput: async () => ({
          result: false,
          attributes: { error: "accountId is required" },
        }),
      });
      const executors = useExecutors([callable]);
      try {
        await executors.callFunction("validated_fn", "{}");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("callable.validation_failed");
        const ctx = (e as LlmExeError).context as Record<string, any>;
        expect(ctx.received).toBe("accountId is required");
      }
      expect(handler).not.toHaveBeenCalled();
    });

    it("executes when visibility and validation both pass", async () => {
      const callable = new CallableExecutor({
        name: "allowed_fn",
        description: "Allowed",
        input: "{}",
        handler: async () => "ran",
        visibilityHandler: () => true,
        validateInput: async () => ({ result: true, attributes: {} }),
      });
      const executors = useExecutors([callable]);
      const result = await executors.callFunction("allowed_fn", "{}");
      expect(result).toEqual({ result: "ran", attributes: {} });
    });
  });

  describe("CallableExecutor attributes and parameters", () => {
    it("stores custom attributes from constructor", () => {
      const callable = new CallableExecutor({
        name: "fn_with_attrs",
        description: "Has attributes",
        input: "{}",
        handler: async () => "ok",
        attributes: { category: "search", priority: 1 },
      });
      expect(callable.attributes).toEqual({ category: "search", priority: 1 });
    });

    it("defaults attributes to empty object", () => {
      const callable = new CallableExecutor({
        name: "fn_no_attrs",
        description: "No attributes",
        input: "{}",
        handler: async () => "ok",
      });
      expect(callable.attributes).toEqual({});
    });

    it("stores custom parameters from constructor", () => {
      const callable = new CallableExecutor({
        name: "fn_with_params",
        description: "Has parameters",
        input: "{}",
        handler: async () => "ok",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
        },
      });
      expect(callable.parameters).toEqual({
        type: "object",
        properties: { query: { type: "string" } },
      });
    });

    it("defaults parameters to empty object", () => {
      const callable = new CallableExecutor({
        name: "fn_no_params",
        description: "No parameters",
        input: "{}",
        handler: async () => "ok",
      });
      expect(callable.parameters).toEqual({});
    });
  });

  describe("CallableExecutor.validateInput edge cases", () => {
    it("returns result with enforceResultAttributes wrapping for bare boolean", async () => {
      const callable = new CallableExecutor({
        name: "validate_bare",
        description: "Returns bare boolean",
        input: "{}",
        handler: async () => "ok",
        validateInput: async () => true as any,
      });
      const result = await callable.validateInput({});
      expect(result).toEqual({ result: true, attributes: {} });
    });

    it("returns false with error when validateInput throws", async () => {
      const callable = new CallableExecutor({
        name: "validate_throw",
        description: "Throws error",
        input: "{}",
        handler: async () => "ok",
        validateInput: async () => {
          throw new Error("validation failed");
        },
      });
      const result = await callable.validateInput({});
      expect(result).toEqual({
        result: false,
        attributes: { error: "validation failed" },
      });
    });

    it("preserves message verbatim when validateInput throws an LlmExeError", async () => {
      const callable = new CallableExecutor({
        name: "validate_llm_exe",
        description: "Throws typed error",
        input: "{}",
        handler: async () => "ok",
        validateInput: async () => {
          throw new LlmExeError("typed failure", {
            code: "callable.validation_failed",
            context: { operation: "validateInput.preexisting" },
          });
        },
      });
      const result = await callable.validateInput({});
      expect(result).toEqual({
        result: false,
        attributes: { error: "typed failure" },
      });
    });

    it("falls back to String(error) when validateInput throws a non-Error value", async () => {
      const callable = new CallableExecutor({
        name: "validate_string_throw",
        description: "Throws raw value",
        input: "{}",
        handler: async () => "ok",
        validateInput: async () => {
          throw "bare-string-throw";
        },
      });
      const result = await callable.validateInput({});
      expect(result).toEqual({
        result: false,
        attributes: { error: "bare-string-throw" },
      });
    });
  });

  describe("v3 typed errors (internal — public return shapes unchanged)", () => {
    it("constructor throws LlmExeError with callable.invalid_handler", () => {
      try {
        new CallableExecutor({
          name: "no_handler",
          description: "missing",
          input: "{}",
        } as any);
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as LlmExeError).code).toBe("callable.invalid_handler");
        expect((e as LlmExeError).category).toBe("callable");
        const ctx = (e as LlmExeError).context as Record<string, unknown>;
        expect(ctx.operation).toBe("CallableExecutor.constructor");
        expect(ctx.functionName).toBe("no_handler");
        expect(ctx.key).toBe("no_handler");
        expect(ctx.expected).toBe("function or BaseExecutor");
        expect(ctx.received).toBe("undefined");
      }
    });

    it("constructor preserves the legacy 'Invalid handler' message", () => {
      try {
        new CallableExecutor({
          name: "no_handler",
          description: "missing",
          input: "{}",
        } as any);
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect((e as Error).message).toBe("Invalid handler");
      }
    });

    it("callFunction throws a typed error when handler is missing", async () => {
      const executors = useExecutors([callableFn]);
      await expect(
        executors.callFunction("missing_handler", "{}")
      ).rejects.toThrow(
        "[invalid handler] The handler (missing_handler) does not exist."
      );
    });

    it("validateFunctionInput return shape stays { result, attributes } when handler is missing", async () => {
      const executors = useExecutors([callableFn]);
      const result = await executors.validateFunctionInput(
        "missing_handler",
        "{}"
      );
      expect(result).toEqual({
        result: false,
        attributes: {
          error:
            "[invalid handler] The handler (missing_handler) does not exist.",
        },
      });
    });
  });
});
