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
