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

## Where ExecutionContext Is Available

`ExecutionContext` is exposed in three places:

- **Parser callbacks** — `createCustomParser(name, (text, context) => ...)`
- **Hooks** — the first argument to `onSuccess`, `onError`, and `onComplete` is execution metadata; pair it with the executor metadata as the second argument
- **Trace IDs** — `executor.withTraceId(id)` sets `traceId` on the context surfaced to parsers and hooks

`createCoreExecutor(handler)` wraps a plain function, and that function only receives the executor input — it does not currently receive an `ExecutionContext` argument.

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
