import {
  ExecutorExecutionMetadata,
  ExecutorExecutionMetadataProperties,
} from "@/interfaces";

export class ExecutorExecutionMetadataState<I, O> {
  #state: ExecutorExecutionMetadata = {
    start: null,
    end: null,
    input: undefined,
    handlerInput: undefined,
    handlerOutput: undefined,
    output: undefined,
    errorMessage: undefined,
    error: undefined,
    errorCategory: undefined,
    errorCode: undefined,
    errorContext: undefined,
    errorCause: undefined,
    hookErrors: undefined,
    metadata: null,
  };

  constructor(
    items?: Pick<ExecutorExecutionMetadataProperties, "start"> &
      Partial<ExecutorExecutionMetadataProperties>
  ) {
    if (items) {
      this.setItem(items);
    }
  }

  setItem(items: Partial<ExecutorExecutionMetadataProperties>) {
    // if invalid, do nothing
    if (!items || typeof items !== "object" || Array.isArray(items)) {
      return this;
    }

    const keys = Object.keys(items) as (keyof typeof items)[];
    for (const key of keys) {
      const value = items[key];
      this.#state[key] = value;
    }
    return this;
  }
  asPlainObject(): Readonly<ExecutorExecutionMetadata<I, O>> {
    return Object.freeze({
      start: this.#state.start,
      end: this.#state.end,
      input: this.#state.input,
      handlerInput: this.#state.handlerInput,
      handlerOutput: this.#state.handlerOutput,
      output: this.#state.output,
      errorMessage: this.#state.errorMessage,
      error: this.#state.error,
      errorCategory: this.#state.errorCategory,
      errorCode: this.#state.errorCode,
      errorContext: this.#state.errorContext,
      errorCause: this.#state.errorCause,
      hookErrors: this.#state.hookErrors,
      metadata: this.#state.metadata,
    });
  }
}

export function createMetadataState(
  items?: Pick<ExecutorExecutionMetadataProperties, "start"> &
    Partial<ExecutorExecutionMetadataProperties>
): ExecutorExecutionMetadataState<any, any> {
  return new ExecutorExecutionMetadataState(items);
}
