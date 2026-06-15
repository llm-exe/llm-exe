import { createCoreExecutor } from "@/executor/_functions";
import { CallableExecutorCore, FunctionOrExecutor, PlainObject } from "@/types";
import { ensureInputIsObject } from "@/utils/modules/ensureInputIsObject";
import { BaseExecutor } from "@/executor";
import { enforceResultAttributes } from "@/utils/modules/enforceResultAttributes";
import { LlmExeError } from "@/errors";

/**
 * Represents the input for a CallableExecutor.
 * @interface CallableExecutorInput
 * @property name - The name of the callable function.
 * @property key - The key for the callable function. Defaults to the name if not provided.
 * @property description - A description of the callable function.
 * @property input - The input for the callable function.
 * @property visibilityHandler - An optional visibility handler for the callable function.
 * @property handler - An optional handler for the callable function.
 */
export interface CallableExecutorInput<
  I extends PlainObject | { input: string },
  O
> extends CallableExecutorCore {
  name: string;
  description: string;
  key?: string;
  parameters?: Record<string, any>;
  input: string;
  attributes?: Record<string, any>;
  visibilityHandler?(
    input: I,
    context: any,
    attributes?: Record<string, any>
  ): boolean;
  handler?: FunctionOrExecutor<I, O>;
  validateInput?(
    input: I,
    ...args: any[]
  ):
    | ReturnType<typeof enforceResultAttributes<boolean>>
    | Promise<ReturnType<typeof enforceResultAttributes<boolean>>>;
}

/**
 * Represents a CallableExecutor.
 * @interface CallableExecutor
 * @property name - The name of the callable core function.
 * @property key - The key for the callable core function.
 * @property description - A description of the callable core function.
 * @property input - The input for the callable core function.
 * @property visibilityHandler - The visibility handler for the callable core function.
 * @property - The handler for the callable core function.
 */
export interface CallableExecutor<I, O> extends CallableExecutorCore {
  key: string;
  attributes: Record<string, any>;
  parameters: Record<string, any>;
  input: string;
  _handler: BaseExecutor<I, O>;
  visibilityHandler(input: any, attributes?: Record<string, any>): boolean;
  _visibilityHandler?(
    input: any,
    context: any,
    attributes?: Record<string, any>
  ): boolean;
  validateInput(
    input: I
  ): Promise<ReturnType<typeof enforceResultAttributes<boolean>>>;
  _validateInput?(
    input: I,
    context: any
  ):
    | ReturnType<typeof enforceResultAttributes<boolean>>
    | Promise<ReturnType<typeof enforceResultAttributes<boolean>>>;
}

/**
 * A class representing a CallableExecutor.
 * @class CallableExecutor
 */
export class CallableExecutor<I extends PlainObject | { input: string }, O> {
  public name: string;
  public key: string;
  public description: string;
  public input: string;
  public attributes: Record<string, any>;
  public parameters: Record<string, any>;
  public _handler: BaseExecutor<I, O>;
  public _validateInput?(
    input: I,
    context: any
  ):
    | ReturnType<typeof enforceResultAttributes<boolean>>
    | Promise<ReturnType<typeof enforceResultAttributes<boolean>>>;
  public _visibilityHandler?(
    input: any,
    context: any,
    attributes?: Record<string, any>
  ): boolean;

  constructor(options: CallableExecutorInput<I, O>) {
    const defaults = {
      key: options.name,
    };

    this.name = options.name;
    this.key = options?.key || defaults.key;
    this.description = options.description;
    this.input = options.input;
    this.parameters = options.parameters || {};
    this.attributes = options?.attributes || {};
    this._validateInput = options.validateInput;
    this._visibilityHandler = options?.visibilityHandler;

    if (options.handler instanceof BaseExecutor) {
      this._handler = options.handler;
    } else if (typeof options.handler === "function") {
      this._handler = createCoreExecutor(options.handler);
    } else {
      throw new LlmExeError("Invalid handler", {
        code: "callable.invalid_handler",
        context: {
          operation: "CallableExecutor.constructor",
          functionName: options.name,
          key: options?.key || options.name,
          expected: "function or BaseExecutor",
          received: typeof options.handler,
          resolution:
            "Pass a function or a BaseExecutor instance as the handler.",
        },
      });
    }
  }
  async execute(input: I): Promise<{ result: O; attributes: any }> {
    const response = await this._handler.execute(ensureInputIsObject(input));
    return enforceResultAttributes(response);
  }
  async validateInput(input: I): Promise<{ result: boolean; attributes: any }> {
    try {
      if (typeof this._validateInput === "function") {
        const response = await this._validateInput(
          ensureInputIsObject(input),
          this._handler.getMetadata()
        );
        return enforceResultAttributes(response);
      }
      return { result: true, attributes: {} };
    } catch (error: any) {
      // Wrap the caught error in a typed LlmExeError. The wrap is internal —
      // public return shape stays { result: false, attributes: { error: msg } }
      // with the user's original message text preserved. The typed error is
      // here for parity with the rest of the codebase and so a future opt-in
      // API can surface structured detail through metadata without us having
      // to revisit this site.
      const wrapped =
        error instanceof LlmExeError
          ? error
          : new LlmExeError(error?.message ?? String(error), {
              code: "callable.validation_failed",
              context: {
                operation: "CallableExecutor.validateInput",
                functionName: this.name,
                key: this.key,
              },
              cause: error,
            });
      return { result: false, attributes: { error: wrapped.message } };
    }
  }
  visibilityHandler(input: any, attributes: any): boolean {
    if (typeof this._visibilityHandler === "function") {
      return this._visibilityHandler(
        input,
        this._handler.getMetadata(),
        attributes
      );
    }
    return true;
  }
}

export abstract class UseExecutorsBase<
  I extends PlainObject | { input: string },
  O
> {
  public handlers: CallableExecutor<I, O>[] = [];
  constructor(handlers: CallableExecutor<I, O>[]) {
    this.handlers = handlers;
  }
  hasFunction(name: string): boolean {
    return !!this.getFunction(name);
  }
  getFunction(name: string): CallableExecutor<I, O> | undefined {
    return this.handlers.find((a) => a.name === name);
  }
  getFunctions() {
    return [...this.handlers];
  }
  getVisibleFunctions(_input: any, _attributes: any = {}) {
    const handlers = this.getFunctions();

    return handlers.filter(
      (a) =>
        typeof a.visibilityHandler === "undefined" ||
        (typeof a.visibilityHandler === "function" &&
          a.visibilityHandler(_input, _attributes))
    );
  }
  async callFunction(
    name: string,
    input: string
  ): Promise<{
    result: any;
    attributes: any;
  }> {
    try {
      const handler = this.getFunction(name);
      if (!handler) {
        throw new LlmExeError(
          `[invalid handler] The handler (${name}) does not exist.`,
          {
            code: "callable.handler_not_found",
            context: {
              operation: "UseExecutorsBase.callFunction",
              functionName: name,
              availableFunctions: this.handlers.map((h) => h.name),
            },
          }
        );
      }
      const result = await handler.execute(ensureInputIsObject(input) as any);
      return result;
    } catch (error: any) {
      // Public return shape preserved: callFunction returns the message string
      // on failure. The typed error stays internal-only for now.
      return error.message;
    }
  }
  async validateFunctionInput(name: string, input: string) {
    try {
      const handler = this.getFunction(name);
      if (!handler) {
        throw new LlmExeError(
          `[invalid handler] The handler (${name}) does not exist.`,
          {
            code: "callable.handler_not_found",
            context: {
              operation: "UseExecutorsBase.validateFunctionInput",
              functionName: name,
              availableFunctions: this.handlers.map((h) => h.name),
            },
          }
        );
      }
      const result = await handler.validateInput(
        ensureInputIsObject(input) as any
      );
      return result;
    } catch (error: any) {
      return { result: false, attributes: { error: error.message } };
    }
  }
}
