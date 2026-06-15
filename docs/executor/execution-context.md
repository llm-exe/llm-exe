---
title: ExecutionContext | llm-exe
description: "Reference for the per-call ExecutionContext object."
---

# ExecutionContext

`ExecutionContext` is the context object for one executor run. It includes the trace ID, executor metadata, execution metadata, and attributes.

```ts
import type { ExecutionContext } from "llm-exe";

type ExecutionContextShape<I, O> = {
  traceId?: string;
  executor: {
    id: string;
    type: string;
    name: string;
    created: number;
    executions: number;
    metadata?: Record<string, any>;
  };
  execution: {
    start: number | null;
    end: number | null;
    input: I;
    handlerInput?: any;
    handlerOutput?: any;
    output?: O;
    errorMessage?: string;
    error?: Error;
    errorCategory?: string;
    errorCode?: string;
    errorContext?: unknown;
    errorCause?: unknown;
  };
  attributes: Record<string, any>;
};
```

## Executor Handlers

Executor handlers receive context as the third argument.

```ts
const executor = createCoreExecutor({
  name: "normalize",
  handler: async (input, context?: ExecutionContext) => {
    return {
      value: input.value,
      traceId: context?.traceId,
      executorName: context?.executor.name,
    };
  },
});
```

## Parser Callbacks

Custom parser callbacks receive `ExecutionContext` as the second argument.

```ts
const parser = createCustomParser("example", (text, context) => {
  return {
    text,
    input: context?.execution.input,
    executorName: context?.executor.name,
    traceId: context?.traceId,
  };
});
```

Execution data is available on `context.execution`. Executor metadata is available on `context.executor`.

## Trace IDs

Use `withTraceId()` to set a trace ID on the executor.

```ts
const executor = createLlmExecutor({ llm, prompt, parser });
executor.withTraceId("req-123");

await executor.execute({ input: "hello" });
```

The trace ID is included in `ExecutionContext`, hook metadata, and deprecation warning details.

## Error Metadata

When an execution throws an `LlmExeError`, structured error fields are copied into execution metadata:

```ts
executor.on("onError", (exec) => {
  console.log(exec.errorCode);
  console.log(exec.errorCategory);
  console.log(exec.errorContext);
});
```

Plain `Error` values still populate `error` and `errorMessage`.
