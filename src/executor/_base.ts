import {
  PlainObject,
  ExecutorMetadata,
  HookErrorRecord,
  ListenerFunction,
  CoreExecutorHookInput,
  ExecutorExecutionMetadata,
  CoreExecutorExecuteOptions,
  BaseExecutorHooks,
  ExecutionContext,
} from "@/types";
import { pick } from "@/utils/modules/pick";
import { ensureInputIsObject } from "@/utils/modules/ensureInputIsObject";
import { uuid } from "@/utils/modules/uuid";
import { createMetadataState } from "./_metadata";
import { hookOnComplete, hookOnError, hookOnSuccess } from "@/utils/const";
import { LlmExeError } from "@/errors";
import { getErrorMetadata } from "@/errors/getErrorMetadata";

/**
 * BaseExecutor
 * @template I - Input type.
 * @template O - Output type.
 * @template H - Hooks type.
 */
export abstract class BaseExecutor<
  I extends PlainObject,
  O = any,
  H extends BaseExecutorHooks = BaseExecutorHooks,
> {
  /**
   * @property id - internal id of the executor
   */
  readonly id;

  /**
   * @property type - type of executor
   */
  public type;

  /**
   * @property created - timestamp date created
   */
  readonly created;

  /**
   * @property name - name of executor
   */
  public name;

  /**
   * @property executions -
   */
  public executions;

  public traceId: string | null = null;
  /**
   * @property hooks - hooks to be ran during execution
   */
  public hooks: any;
  readonly allowedHooks: any[] = [hookOnComplete, hookOnError, hookOnSuccess];

  /**
   * @property maxHooksPerEvent - Maximum number of hooks allowed per event
   */
  readonly maxHooksPerEvent: number = 100;

  constructor(
    name: string,
    type: string,
    options?: CoreExecutorExecuteOptions<H>
  ) {
    this.id = uuid();
    this.type = type;
    this.name = name;
    this.created = new Date().getTime();
    this.executions = 0;
    this.hooks = {
      onSuccess: [],
      onError: [],
      onComplete: [],
    };

    if (options?.hooks) {
      this.setHooks(options.hooks);
    }
  }

  abstract handler(
    input: I,
    _options?: any,
    _context?: ExecutionContext<I, O>
  ): Promise<any>;

  /**
   * Build a per-call execution context snapshot. Captures the current
   * execution metadata so the snapshot reflects state at the time it was
   * taken (e.g. `handlerInput` becomes available after `getHandlerInput`).
   */
  protected snapshotContext(
    execution: ExecutorExecutionMetadata<I, O>
  ): ExecutionContext<I, O> {
    return {
      traceId: this.getTraceId() ?? undefined,
      executor: this.getMetadata(),
      execution,
      attributes: {},
    };
  }

  /**
   *
   * Used to filter the input of the handler.
   *
   * Throws a `TypeError` if `_input` is `null` or `undefined`. The declared
   * input type is `I extends PlainObject`; omitting input or passing an
   * explicit `null` is a contract violation with no valid coercion, so we
   * surface it loudly rather than silently wrapping it.
   *
   * Non-object inputs (strings, numbers, arrays) are intentionally coerced
   * to `{ input: value }` via {@link ensureInputIsObject}. This preserves the
   * convenience pattern used by tool/function callables, which forward raw
   * string arguments into an executor.
   *
   * @param _input
   * @returns original input formatted for handler
   */
  async getHandlerInput(
    _input: I,
    _metadata: ExecutorExecutionMetadata<I, any>,
    _options?: any
  ): Promise<any> {
    if (_input === null || typeof _input === "undefined") {
      throw new TypeError(
        `[llm-exe] Executor "${this.name}" received null or undefined as input. ` +
          `execute() expects an object matching the prompt's input type.`
      );
    }
    return ensureInputIsObject(_input);
  }

  /**
   *
   * Used to filter the output of the handler
   * @param _input
   * @returns output O
   */
  getHandlerOutput(
    out: any,
    _metadata: ExecutorExecutionMetadata<any, O>,
    _options?: any,
    _context?: ExecutionContext<I, O>
  ): O {
    return out as O;
  }
  /**
   *
   * execute - Runs the executor
   * @param _input
   * @returns handler output
   */
  async execute(_input: I, _options?: any): Promise<O> {
    this.executions++;
    const _metadata = createMetadataState({
      start: new Date().getTime(),
      input: _input,
    });

    try {
      const input = await this.getHandlerInput(
        _input,
        _metadata.asPlainObject(),
        _options
      );

      _metadata.setItem({ handlerInput: input });

      let result = await this.handler(
        input,
        _options,
        this.snapshotContext(_metadata.asPlainObject())
      );

      _metadata.setItem({ handlerOutput: result });

      const output = this.getHandlerOutput(
        result,
        _metadata.asPlainObject(),
        _options,
        this.snapshotContext(_metadata.asPlainObject())
      );
      _metadata.setItem({ output });

      this.collectHookErrors(
        this.runHook("onSuccess", _metadata.asPlainObject()),
        _metadata
      );
      return output;
    } catch (error: any) {
      _metadata.setItem({
        error,
        errorMessage: error.message,
        ...getErrorMetadata(error),
      });
      this.collectHookErrors(
        this.runHook("onError", _metadata.asPlainObject()),
        _metadata
      );
      throw error;
    } finally {
      _metadata.setItem({ end: new Date().getTime() });
      // onComplete is the last hook to fire. If a user callback registered
      // here throws, there is nothing after to surface the failure into the
      // returned metadata. The return value is still collected for callers
      // who want to inspect it via a wrapped runHook; future onHookError
      // support would close this gap.
      this.runHook("onComplete", _metadata.asPlainObject());
    }
  }

  private collectHookErrors(
    fresh: HookErrorRecord[],
    state: ReturnType<typeof createMetadataState>
  ) {
    if (fresh.length === 0) return;
    const existing = state.asPlainObject().hookErrors ?? [];
    state.setItem({ hookErrors: [...existing, ...fresh] });
  }

  metadata(): Record<string, any> {
    return {};
  }

  getMetadata(metadata?: Record<string, any>): ExecutorMetadata {
    return Object.assign({}, this.metadata(), {
      traceId: this.getTraceId(),
      id: this.id,
      type: this.type,
      name: this.name,
      created: this.created,
      executions: this.executions,
      metadata,
    });
  }

  runHook(
    hook: keyof H,
    _metadata: ExecutorExecutionMetadata
  ): HookErrorRecord[] {
    /* istanbul ignore next */
    const { [hook]: hooks = [] } = pick(this.hooks, this.allowedHooks);
    const errors: HookErrorRecord[] = [];
    for (const hookFn of [...hooks] /** clone hooks */) {
      if (typeof hookFn === "function") {
        try {
          hookFn(_metadata, this.getMetadata());
        } catch (error) {
          // Collect instead of console.warn. The caller (execute()) folds
          // these into the execution metadata so onComplete can see them.
          // The raw error is preserved (name/stack/cause for plain Errors).
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push({
            hook: String(hook),
            error,
            errorMessage: message,
            ...getErrorMetadata(error),
          });
        }
      }
    }
    return errors;
  }
  setHooks(hooks: CoreExecutorHookInput<H> = {}) {
    const hookKeys = Object.keys(hooks) as (keyof typeof hooks)[];
    for (const hookKey of hookKeys.filter((k) =>
      this.allowedHooks.includes(k)
    )) {
      const hookInput = hooks[hookKey];
      if (hookInput) {
        const _hooks = Array.isArray(hookInput) ? hookInput : [hookInput];
        for (const hook of _hooks) {
          if (
            hook &&
            typeof hook === "function" &&
            !this.hooks[hookKey].find((h: ListenerFunction) => h === hook)
          ) {
            // Enforce hook limit to prevent unbounded memory growth
            if (this.hooks[hookKey].length >= this.maxHooksPerEvent) {
              throw new LlmExeError(
                `Maximum number of hooks (${this.maxHooksPerEvent}) reached for event "${String(hookKey)}". ` +
                  `Consider removing unused hooks or increasing the limit.`,
                {
                  code: "executor.hook_limit_reached",
                  context: {
                    operation: "BaseExecutor.setHooks",
                    executorName: this.name,
                    executorType: this.type,
                    hook: String(hookKey),
                    hookCount: this.hooks[hookKey].length,
                    maxHooksPerEvent: this.maxHooksPerEvent,
                  },
                }
              );
            }
            this.hooks[hookKey].push(hook);
          }
        }
      }
    }
    return this;
  }

  removeHook(eventName: keyof H, fn: ListenerFunction) {
    if (typeof fn !== "function") return this;
    const lis = this.hooks[eventName];
    if (!lis) return this;
    for (let i = lis.length; i >= 0; i--) {
      if (lis[i] === fn) {
        lis.splice(i, 1);
        break;
      }
    }
    return this;
  }

  on(eventName: keyof H, fn: ListenerFunction) {
    return this.setHooks({ [eventName]: fn } as CoreExecutorHookInput<H>);
  }

  off(eventName: keyof H, fn: ListenerFunction) {
    return this.removeHook(eventName, fn);
  }

  once(eventName: keyof H, fn: ListenerFunction) {
    if (typeof fn !== "function") return this;

    // Enforce hook limit to prevent unbounded memory growth
    if (
      this.hooks[eventName] &&
      this.hooks[eventName].length >= this.maxHooksPerEvent
    ) {
      throw new LlmExeError(
        `Maximum number of hooks (${this.maxHooksPerEvent}) reached for event "${String(eventName)}". ` +
          `Consider removing unused hooks or increasing the limit.`,
        {
          code: "executor.hook_limit_reached",
          context: {
            operation: "BaseExecutor.once",
            executorName: this.name,
            executorType: this.type,
            hook: String(eventName),
            hookCount: this.hooks[eventName].length,
            maxHooksPerEvent: this.maxHooksPerEvent,
          },
        }
      );
    }

    // Wrapper that removes itself after first execution. try/finally so a
    // throwing fn still self-removes — otherwise runHook() catches the throw,
    // off() never runs, and the wrapper stays registered forever.
    const onceWrapper: ListenerFunction = (...args: any[]) => {
      try {
        fn(...args);
      } finally {
        this.off(eventName, onceWrapper);
      }
    };

    if (!this.hooks[eventName]) {
      this.hooks[eventName] = [];
    }
    this.hooks[eventName].push(onceWrapper);
    return this;
  }
  withTraceId(traceId: string) {
    this.traceId = traceId;
    return this;
  }
  getTraceId() {
    return this.traceId;
  }

  /**
   * Clear all hooks for a specific event or all events
   * Useful for preventing memory leaks in long-running processes
   * @param eventName - The event name to clear hooks for
   */
  clearHooks(eventName?: keyof H) {
    if (eventName) {
      if (this.hooks[eventName]) {
        this.hooks[eventName] = [];
      }
    } else {
      // Clear all hooks across all allowed events
      for (const key of this.allowedHooks) {
        if (this.hooks[key]) {
          this.hooks[key] = [];
        }
      }
    }
    return this;
  }

  /**
   * Get the count of hooks for monitoring memory usage
   * @param eventName - Optional event name to get count for
   * @returns Hook count for specific event or all events
   */
  getHookCount(eventName?: keyof H): number | Record<string, number> {
    if (eventName) {
      return this.hooks[eventName]?.length || 0;
    }

    // Return counts for all events
    const counts: Record<string, number> = {};
    for (const key of this.allowedHooks) {
      counts[key] = this.hooks[key]?.length || 0;
    }
    return counts;
  }
}
