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
- **Trace IDs** — `execute(input, { traceId })` or `executor.withTraceId(id)` sets `traceId` on the context surfaced to parsers and hooks

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

Pass `traceId` in the options to `execute()` to tag one call:

```ts
const executor = createLlmExecutor({ llm, prompt, parser });

await executor.execute({ input: "hello" }, { traceId: "req-123" });
```

`withTraceId()` sets a trace ID on the executor instance instead, and every call on that executor shares it. If one executor serves concurrent requests, they overwrite each other's ID, so use the per-call option there. When both are set, the per-call `traceId` wins and the instance value stays unchanged.

The trace ID is included in `ExecutionContext`, hook metadata, and deprecation warning details. It isn't attached to errors thrown by provider requests.

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
