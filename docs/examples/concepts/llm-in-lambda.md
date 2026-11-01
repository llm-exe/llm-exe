---
title: "Call an LLM from AWS Lambda or a Cron Job | llm-exe"
description: "Run LLM calls in AWS Lambda or scheduled jobs with TypeScript: module-scope executors for warm starts, timeouts under the function limit, and typed results."
---

## LLM Calls in Lambda and Cron Jobs

A lot of useful LLM automation is a scheduled or event-driven function: classify each new support ticket, summarize yesterday's signups, triage incoming feedback. No server, no framework — one handler that makes one typed LLM call. This recipe shows the Lambda shape; the same pattern applies to any cron runner or queue consumer.

#### Step 1 - Create the Executor at Module Scope

Everything that doesn't depend on the event goes outside the handler, so warm invocations reuse it. Two settings matter in serverless specifically: `timeout` must stay below your Lambda's own timeout (otherwise Lambda kills the invocation before llm-exe can retry or throw cleanly), and the API key comes from the environment.

<<< ../../../examples/lambdaHandler.ts#setup

#### Step 2 - The Handler Stays Small

<<< ../../../examples/lambdaHandler.ts#handler

The enum-constrained parser means `category` is a typed union — the handler can route, tag, or store it without validating anything itself. If the model's response doesn't contain one of the three categories, the executor throws and the invocation fails visibly (and your dead-letter queue or retry policy takes over), rather than writing a garbage category to your database.

### Serverless checklist

- **Budget retries inside the function timeout.** `numOfAttempts: 2` with `timeout: 20000` can take ~40+ seconds worst-case — make sure the Lambda timeout accommodates the whole retry budget, or lower it.
- **Keys from environment/secrets manager**, never bundled. All providers accept keys via options (as shown) or standard env vars.
- **Let failures fail.** In event-driven code, a thrown `LlmExeError` with the event going to your DLQ beats a swallowed error and a silent gap in your data.
- **Log with hooks.** Attach `onComplete`/`onError` [hooks](/executor/hooks) at module scope for structured logs and latency metrics on every invocation.

For deeper AWS integration — using llm-exe inside Step Functions state machines — that pattern works too; the executor is just an async function, so anything that can run Node can run it.

### Related

- [Add Retries and Timeouts](/examples/concepts/retries-and-timeouts) — the timeout/retry options in depth
- [Executor Hooks](/executor/hooks) — structured logging and latency metrics
- [Intent Classification](/examples/bots/intent) — richer classification with custom parsers
- [Get a Yes/No Decision from an LLM](/examples/bots/yes-no) — boolean decisions for workflow gating
