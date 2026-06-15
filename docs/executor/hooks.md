## LLM Executor Hooks

Hooks are available mostly for logging purposes, but can have more advanced use-cases. Hooks are functions you can define which get called at certain stages of the execution. Hooks are optional, and you can register more than one function per hook (meaning there can be many functions listening on the same hook).

The following hooks are available:

- `onSuccess` — runs after a successful execution, once the output has been produced
- `onError` — runs when the executor throws, before the error is re-thrown
- `onComplete` — runs after `onSuccess` or `onError`, regardless of outcome

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
| `executionMetadata.handlerOutput`  | `onSuccess`, `onComplete` | The raw handler output before parsing            |
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
