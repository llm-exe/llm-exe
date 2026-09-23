---
title: "LLM Hooks: Log, Monitor, and Instrument LLM Calls | llm-exe"
description: "LLM hooks are lifecycle callbacks that fire around LLM calls, so you can log, measure latency, and alert on failures without cluttering business logic."
---

## LLM Hooks

**LLM hooks are lifecycle callbacks that fire at specific points around an LLM call** — before results are returned, when a call fails, and when execution finishes. Instead of wrapping every LLM call in try/catch blocks and timing code, you register a hook once and it runs on every execution. This keeps cross-cutting concerns — logging, metrics, alerting, auditing — out of your business logic.

Typical things you'd use LLM hooks for:

- **Logging** every prompt input and parsed output for debugging or audit trails
- **Latency tracking** — measure how long each LLM call takes and send it to your metrics system
- **Error monitoring** — capture failures (timeouts, parse errors, provider errors) and alert on them
- **Usage analytics** — count executions per function to see which LLM features get used

In llm-exe, every executor supports hooks. They are optional, and you can register more than one function per hook (meaning there can be many functions listening on the same hook).

The following hooks are available:

- `onSuccess` — runs after a successful execution, once the output has been produced
- `onError` — runs when the executor throws, before the error is re-thrown
- `onComplete` — runs after `onSuccess` or `onError`, regardless of outcome

### Common Patterns

Log the duration of every LLM call:

```typescript:no-line-numbers
const classifier = createLlmExecutor({ name: "classify-ticket", llm, prompt, parser });

classifier.on("onComplete", (exec, meta) => {
  logger.info(`${meta.name} finished in ${exec.end - exec.start}ms`, {
    executions: meta.executions,
  });
});
```

Alert on failures without touching the call site:

```typescript:no-line-numbers
classifier.on("onError", (exec, meta) => {
  alerting.notify(`LLM call ${meta.name} failed: ${exec.errorMessage}`, {
    code: exec.errorCode,
    input: exec.input,
  });
});
```

The executor still throws on failure — `onError` observes the error, it does not swallow it. Your calling code handles the failure; the hook handles the telemetry. For a complete production setup combining hooks with retries and timeouts, see [Add Retries and Timeouts to LLM Calls](/examples/concepts/retries-and-timeouts).

### Hook Signature

Every hook receives the same two arguments:

```typescript
type Hook = (
  executionMetadata: ExecutorExecutionMetadata,
  executorMetadata: ExecutorMetadata
) => void;
```

`executionMetadata` contains information about this specific execution (input, output, timings, and — for `onError` — the thrown error). `executorMetadata` contains information about the executor instance itself (id, type, name, total executions).

| Field                              | Available on              | Description                                      |
| ---------------------------------- | ------------------------- | ------------------------------------------------ |
| `executionMetadata.input`          | all hooks                 | The input passed to `.execute()`                 |
| `executionMetadata.output`         | `onSuccess`, `onComplete` | The parsed output returned by the executor       |
| `executionMetadata.handlerInput`   | all hooks                 | The transformed input passed to the internal handler |
| `executionMetadata.handlerOutput`  | `onSuccess`, `onError`, `onComplete` | The raw handler output before parsing (see [Recovering Usage After a Parser Failure](#recovering-usage-after-a-parser-failure)) |
| `executionMetadata.error`          | `onError`, `onComplete`   | The thrown `Error` instance                      |
| `executionMetadata.errorMessage`   | `onError`, `onComplete`   | Shortcut for `error.message`                     |
| `executionMetadata.errorCategory`  | `onError`, `onComplete`   | Structured category for `LlmExeError` failures  |
| `executionMetadata.errorCode`      | `onError`, `onComplete`   | Structured code for `LlmExeError` failures      |
| `executionMetadata.errorContext`   | `onError`, `onComplete`   | Structured context for `LlmExeError` failures   |
| `executionMetadata.hookErrors`     | later hooks               | Failures captured from earlier hook callbacks   |
| `executionMetadata.start`          | all hooks                 | Execution start time (ms since epoch)            |
| `executionMetadata.end`            | `onComplete`              | Execution end time (ms since epoch)              |
| `executorMetadata.id`              | all hooks                 | Stable id of the executor                        |
| `executorMetadata.name`            | all hooks                 | Name of the executor, if set                     |
| `executorMetadata.type`            | all hooks                 | Type of executor (e.g. `"llm-executor"`)         |
| `executorMetadata.created`         | all hooks                 | Timestamp when the executor was created (ms since epoch) |
| `executorMetadata.executions`      | all hooks                 | Number of times this executor has run            |

Hooks should be synchronous and lightweight. Errors thrown inside a hook are caught and collected by llm-exe. They do not affect the executor result.

The "Available on" column describes which hooks *can* see a field, not a guarantee that it is populated. Availability tracks how far the execution actually got: each field is recorded as its step completes, so a failure part-way through leaves the later fields absent — including in `onComplete`, which always runs regardless of where the execution stopped. Treat `handlerOutput` and `output` as optional in error-path hooks.

### Recovering Usage After a Parser Failure

`handlerOutput` is recorded as soon as the handler resolves, *before* the parser runs. When the provider returns a perfectly good — and billable — response and parsing then throws, the raw response is still attached to the metadata passed to `onError` and `onComplete`. This means a parser failure never has to mean lost usage accounting.

On an LLM executor, `handlerOutput` is typed as the normalized `BaseLlCall`, so `getResult().usage` resolves to `OutputUsage` with no casting:

```typescript:no-line-numbers
import type { OutputUsage } from "llm-exe";

executor.on("onError", (exec) => {
  const usage: OutputUsage | undefined = exec.handlerOutput?.getResult().usage;

  if (usage) {
    // The call was billed even though we could not parse it.
    metrics.recordTokens({ ...usage, outcome: "parse-failed" });
  }
});
```

The optional chaining is load-bearing. `handlerOutput` is absent whenever the execution failed *before* the handler resolved — a prompt that fails to format, or a provider call that throws or times out. In those cases there is no response and nothing was billed, so there is nothing to record.

Because `onComplete` runs on both paths, it is usually the better place to account for usage — one hook, one write, no double counting:

```typescript:no-line-numbers
executor.on("onComplete", (exec) => {
  const usage = exec.handlerOutput?.getResult().usage;

  if (usage) {
    metrics.recordTokens({
      ...usage,
      outcome: exec.error ? "parse-failed" : "ok",
    });
  }
});
```

Avoid recording the same response from `onSuccess` *and* `onComplete`, or from `onError` *and* `onComplete` — both hooks see the same `handlerOutput` for a single execution, so writing from both counts those tokens twice. Pick one hook per metric.

### Hook Errors

If an `onSuccess` or `onError` hook throws, the failure is captured in `executionMetadata.hookErrors` for later hooks such as `onComplete`.

```typescript:no-line-numbers
executor.on("onSuccess", () => {
  throw new Error("logging failed");
});

executor.on("onComplete", (exec) => {
  console.log(exec.hookErrors?.[0]?.errorMessage);
});
```

Each hook error record includes the raw thrown value and `errorMessage`. If the thrown value is an `LlmExeError`, `errorCategory`, `errorCode`, `errorContext`, and `errorCause` are included.

`onComplete` runs last. If an `onComplete` hook throws, there is no later hook where that failure can be surfaced in execution metadata.

You can attach hooks:

- During initialization
- After initialization using `on` / `off` / `once`

#### Adding hooks during initialization

```typescript{5}:no-line-numbers
const hooks = {
  onSuccess: (exec) => console.log("output:", exec.output),
  onError: (exec) => console.error("failed:", exec.errorMessage),
};
const llm = useLlm("openai.chat-mock.v1", {});
const prompt = createChatPrompt("This is a prompt.");
const executor = createLlmExecutor({ llm, prompt }, { hooks });
```

#### Adding hooks after initialization

Use `.on()` to attach a hook, and `.off()` to remove it.

```typescript{10,11,14}:no-line-numbers
function logSuccess(exec) {
  console.log("output:", exec.output);
}

function logError(exec) {
  console.error("failed:", exec.errorMessage);
}

const executor = createLlmExecutor({ llm, prompt });
executor.on("onSuccess", logSuccess);
executor.on("onError", logError);

// Later, detach a specific listener:
executor.off("onSuccess", logSuccess);
```

#### Listening exactly once

Use `.once()` to add a hook that fires on the next execution only and then detaches itself.

```typescript{3}:no-line-numbers
const executor = createLlmExecutor({ llm, prompt });

executor.once("onComplete", (exec) => {
  console.log(`first run took ${exec.end - exec.start}ms`);
});

await executor.execute({});
await executor.execute({}); // the once handler no longer fires
```

::: tip
Default behavior is to not add the same handler to the same hook more than once. There is also a per-event hook limit to prevent unbounded memory growth — if you hit it, remove unused hooks with `.off()` rather than piling on new ones.
:::

#### Clearing hooks

Use `.clearHooks()` to remove all hooks for a specific event, or all events at once. This is useful for preventing memory leaks in long-running processes.

```typescript{3,6}:no-line-numbers
const executor = createLlmExecutor({ llm, prompt });

// Clear hooks for a specific event
executor.clearHooks("onSuccess");

// Clear all hooks across all events
executor.clearHooks();
```

#### Inspecting hook count

Use `.getHookCount()` to check how many hooks are registered, either for a specific event or across all events.

```typescript{3,6}:no-line-numbers
const executor = createLlmExecutor({ llm, prompt });

// Get count for a specific event
const count = executor.getHookCount("onSuccess"); // number

// Get counts for all events
const counts = executor.getHookCount(); // { onSuccess: 0, onError: 0, onComplete: 0 }
```

#### Trace ID

Use `.withTraceId()` to associate an executor with a trace identifier for observability. The trace ID is included in `executorMetadata` passed to hooks.

```typescript{3}:no-line-numbers
const executor = createLlmExecutor({ llm, prompt });

executor.withTraceId("req-abc-123");

executor.on("onComplete", (exec, meta) => {
  console.log(meta.traceId); // "req-abc-123"
});
```
