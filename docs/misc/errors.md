---
title: Error Handling | llm-exe
description: "Reference for LlmExeError, error codes, context, and serialization helpers."
---

# Error Handling

llm-exe uses `LlmExeError` for errors created by the library.

```ts
import { LlmExeError, isLlmExeError } from "llm-exe";
```

## Error Shape

`LlmExeError` exposes these fields:

```ts
try {
  await executor.execute(input);
} catch (error) {
  if (isLlmExeError(error)) {
    console.log(error.code);
    console.log(error.category);
    console.log(error.context);
    console.log(error.cause);
  }
}
```

| Field | Description |
| --- | --- |
| `code` | Machine-readable error code, such as `parser.parse_failed` |
| `category` | The prefix of the code, such as `parser`, `prompt`, or `llm` |
| `context` | Extra metadata about the failure |
| `cause` | Original error, when available |

## Branching on Codes

Use `isLlmExeError(error, code)` to check error codes.

```ts
try {
  const result = parser.parse(output);
} catch (error) {
  if (isLlmExeError(error, "parser.schema_validation_failed")) {
    // The output parsed, but did not match the schema.
  }

  if (isLlmExeError(error, "parser.parse_failed")) {
    // The output could not be parsed.
  }
}
```

You can also pass a list of codes.

```ts
if (
  isLlmExeError(error, [
    "llm.provider_rate_limited",
    "llm.provider_unavailable",
  ])
) {
  // Retry, queue, or fall back.
}
```

## Common Categories

Known error categories include:

- `configuration`
- `parser`
- `prompt`
- `llm`
- `embedding`
- `executor`
- `callable`
- `state`
- `request`
- `auth`
- `template`
- `internal`
- `unknown`

## Retry Behavior

The category is not only for branching in your own code — llm-exe uses it to
decide whether a failed LLM or embedding call is worth retrying.

Errors in these categories are **never retried**, no matter how high
`numOfAttempts` is set. They are deterministic client-side failures — bad
options, an invalid prompt, or missing credentials — so a second identical
attempt would fail identically. They surface on the first attempt instead:

- `configuration`
- `prompt`
- `auth`

Everything else (rate limits, timeouts, provider outages, `unknown`) is retried
up to `numOfAttempts` with the configured back-off. See
[Generic LLM Options](/llm/generic) for `numOfAttempts`, `maxDelay`, and
`jitter`.

## Provider Errors

HTTP failures from LLM providers use typed llm-exe errors:

| Code | Typical cause |
| --- | --- |
| `llm.provider_rate_limited` | Provider returned a rate-limit status |
| `llm.provider_auth_failed` | Missing, invalid, or unauthorized credentials |
| `llm.provider_invalid_request` | Provider rejected the request body or model/options |
| `llm.provider_unavailable` | Timeout, unavailable provider, or server-side failure |
| `llm.provider_http_error` | Other provider HTTP error |

Embedding providers use the same pattern with the `embedding.` prefix.

Provider error context may include:

- `status`
- `statusText`
- `url`
- `providerError`
- `providerErrorBody`
- `responseHeaders`

Secrets are redacted before provider error data is added to context.

## Serialization

`LlmExeError` instances implement `toJSON()`, which returns a structured,
JSON-safe payload for logs, queues, or telemetry.

```ts
if (isLlmExeError(error)) {
  const payload = error.toJSON();
  logger.error(payload);
}
```

The payload includes `name`, `message`, `code`, `category`, `context`, and a
serialized `cause` when one is set. Secrets in provider error context are
redacted before serialization.

### `serializeLlmExeError`

`error.toJSON()` only works when the value you caught is an `LlmExeError`. In a
`catch` block you rarely know the type ahead of time — the error could be a
plain `Error`, a rejected `fetch` `Response`, or something a dependency threw.
`serializeLlmExeError(error, options?)` accepts **any** value and always returns
a JSON-safe payload, so you can log it without a type guard.

```ts
import { serializeLlmExeError } from "llm-exe";

try {
  await executor.execute(input);
} catch (error) {
  logger.error(serializeLlmExeError(error));
}
```

- Serializes `LlmExeError`, native `Error`, `Response`, and arbitrary objects.
- Walks the `cause` chain (up to 5 levels; deeper causes are marked
  `{ truncated: true }`).
- Guards against circular references (rendered as `"[Circular]"`) and normalizes
  values that are not JSON-safe (`BigInt`, `Date`, `Map`, functions, etc.).
- Secrets in provider error context are redacted.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `includeStack` | `boolean` | `false` | Include the error's `stack` string in the payload. |

### `formatLlmExeErrorForLog`

When you want a compact, human-readable single string instead of a structured
object — for a plain-text log line, for example — use
`formatLlmExeErrorForLog(error)`. It also accepts any value and never throws.

```ts
import { formatLlmExeErrorForLog } from "llm-exe";

try {
  await executor.execute(input);
} catch (error) {
  console.error(formatLlmExeErrorForLog(error));
  // LlmExeError [parser.schema_validation_failed]: requires property "name"
  // Caused by: Error: Unexpected token
}
```

The header is formatted as `Name [code]: message` (falling back to the
`category`, then just the name when neither is present), followed by one
`Caused by:` line per level of the `cause` chain (up to 5 levels).
