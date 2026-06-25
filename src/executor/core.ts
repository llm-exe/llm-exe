import {
  PlainObject,
  CoreExecutorInput,
  CoreExecutorExecuteOptions,
  ExecutionContext,
} from "@/types";
import { BaseExecutor } from "./_base";
import { inferFunctionName } from "@/utils/modules/inferFunctionName";

/**
 * Core Function Executor
 */
export class CoreExecutor<I extends PlainObject, O> extends BaseExecutor<I, O> {
  public _handler: (
    input: I,
    context?: ExecutionContext<I, O>
  ) => Promise<any> | any;

  constructor(
    fn: CoreExecutorInput<I, O>,
    options?: CoreExecutorExecuteOptions<I, O>
  ) {
    const name = fn?.name
      ? fn.name
      : inferFunctionName(fn.handler, "anonymous-core-executor");

    super(name, "function-executor", options);
    this._handler = fn.handler.bind(null);
  }

  async handler(
    _input: I,
    _options?: any,
    _context?: ExecutionContext<I, O>
  ): Promise<O> {
    return this._handler.call(null, _input, _context);
  }
}
