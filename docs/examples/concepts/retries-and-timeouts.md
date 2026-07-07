---
title: "Add Retries and Timeouts to LLM Calls in TypeScript | llm-exe"
description: "Make LLM calls production-safe in TypeScript: per-call timeouts, automatic retries with backoff, error hooks for alerting, and typed error handling."
---

## Retries and Timeouts

LLM APIs fail in ways normal APIs rarely do: requests hang for 60+ seconds, providers return intermittent 5xx errors under load, and a "successful" response can still be unparseable. Hand-rolling retry loops around every call is the boilerplate llm-exe is built to remove — timeouts, retries, and backoff are configuration, not code.

#### Step 1 - Configure the LLM

All three options are [generic options](/llm/generic) — they work the same for every provider:

<<< ../../../examples/retryAndTimeout.ts#function

- `timeout` — maximum time for a single API call, in milliseconds
- `numOfAttempts` — total attempts before the executor throws
- `maxDelay` — cap on the backoff wait between attempts

#### Step 2 - Observe Failures and Handle the Final Error

Retries handle the transient failures silently. For the failures that survive all attempts, attach an [`onError` hook](/executor/hooks) for telemetry, and catch the typed error at the call site to decide the fallback:

<<< ../../../examples/retryAndTimeout.ts#usage

The hook observes; the `try/catch` decides. `isLlmExeError` narrows the error so you can read `error.code` and `error.category` to distinguish a timeout from a parse failure from a provider error — see [Error Handling](/misc/errors) for the full list of codes.

### What to set the values to

There is no universal right answer, but the trade-offs are consistent:

- **User-facing requests**: short timeout (10–15s), 2 attempts. A user won't wait 90 seconds; fail fast and show a fallback.
- **Background jobs**: longer timeout (30–60s), 3+ attempts. Nobody is waiting, so trade latency for reliability.
- **Parse failures are not transient.** Retrying the identical prompt after a parse failure sometimes helps (sampling varies), but if a prompt fails to parse consistently, fix the prompt or the parser — don't raise `numOfAttempts` to paper over it.

### Related

- [Generic LLM Options](/llm/generic) — full reference for `timeout`, `numOfAttempts`, `maxDelay`, and more
- [Executor Hooks](/executor/hooks) — logging, latency tracking, and alerting on every call
- [Error Handling](/misc/errors) — `LlmExeError` codes and categories
- [Get a Yes/No Decision from an LLM](/examples/bots/yes-no) — a small typed function worth making production-safe
