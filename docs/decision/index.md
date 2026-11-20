---
title: "Decision Executor | Typed Classification with Decision Models | llm-exe"
description: "Ask a decision model typed yes/no, choice, and score questions from TypeScript with llm-exe. One API for OpenAI Decisions, TypeSafe Jev, and Cloudflare Clef, with probabilities instead of parsed text."
---

# Decision Executor

A decision model answers questions about an input. You give it some text (or JSON) and a list of questions, and it returns a probability for every possible answer. It doesn't generate text, so there's no prompt to write and nothing to parse.

That makes it a good fit for classification: is this urgent, which team owns it, how severe is it. You'd normally do that with a prompt plus a [`boolean`](/parser/included-parsers) or enum parser. A decision model does it directly, usually faster and cheaper, and it tells you how sure it is.

The decision executor works the same way with every supported provider:

| Provider | Model keys |
|----------|------------|
| OpenAI Decisions | `openai.gpt-6-luna`, `openai.decisions.v1` |
| TypeSafe Jev | `typesafe.jev`, `typesafe.systemone.v1` |
| Cloudflare Clef | `cloudflare.clef`, `cloudflare.clef-flash` |

See [Decision Model Providers](/decision/providers) for keys, options, and limits.

## Basic Example

```ts
import { useDecisionModel, createDecisionExecutor } from "llm-exe";

const model = useDecisionModel("openai.gpt-6-luna");

const triage = createDecisionExecutor(model, {
  urgent: {
    type: "boolean",
    instructions: "Is this request urgent?",
  },
  team: {
    type: "choice",
    instructions: "Which team should handle this?",
    options: {
      billing: "Payments and refunds",
      technical: "Outages and errors",
    },
  },
  severity: {
    type: "score",
    instructions: "How severe is the customer impact?",
    levels: ["None", "Minor", "Major", "Critical"],
  },
});

const result = await triage.execute({
  input: "I was charged twice and the app crashes when I open settings.",
});
```

`result` looks like this:

```ts
{
  model: "gpt-6-luna",
  answers: {
    urgent: { type: "boolean", probability: 0.95 },
    team: {
      type: "choice",
      choice: "billing",
      confidence: 0.98,
      probabilities: { billing: 0.99, technical: 0.01 },
    },
    severity: {
      type: "score",
      score: 2.99,
      level: "Critical",
      confidence: 0.99,
      probabilities: { None: 0, Minor: 0, Major: 0.01, Critical: 0.99 },
    },
  },
  usage: { inputTokens: 420, outputTokens: 0 },
}
```

It's two steps, like chat: `useDecisionModel` picks the provider, and `createDecisionExecutor` fixes the questions. Change `"openai.gpt-6-luna"` to `"typesafe.jev"` or `"cloudflare.clef"` and nothing else in your code changes.

## Questions

Questions are an object. Each key is the question's name, and it's also how you read the answer back (`result.answers.team`). Names can use letters, digits, `_`, `.` and `-`, up to 100 characters.

Every question has `instructions`: what you want the model to decide. There are three types.

### `boolean`

A yes/no question.

```ts
urgent: { type: "boolean", instructions: "Is this request urgent?" }
```

### `choice`

Pick one option. `options` maps each option's value to a description of when to pick it. Use 1 to 255 options.

```ts
team: {
  type: "choice",
  instructions: "Which team should handle this?",
  options: {
    billing: "Payments and refunds",
    technical: "Outages and errors",
  },
}
```

### `score`

Rate on an ordered scale. List `levels` from lowest to highest. Use 2 to 10 levels, each with a different label. A level is a string, or `{ label, description }` when the label alone isn't clear:

```ts
severity: {
  type: "score",
  instructions: "How severe is the customer impact?",
  levels: [
    "None",
    "Minor",
    "Major",
    { label: "Critical", description: "Money lost or service down" },
  ],
}
```

## Answers

Each answer has a `type` that matches its question.

| Question | Answer |
|----------|--------|
| `boolean` | `{ type: "boolean", probability }`: the probability that the answer is yes, from 0 to 1. |
| `choice` | `{ type: "choice", choice, confidence, probabilities }`: `choice` is the most likely option, and `probabilities` has one entry per option. |
| `score` | `{ type: "score", score, level, confidence, probabilities }`: see below. |

For a score, `score` is the expected position on the scale: 0 for the first level, 1 for the second, and so on. It can be fractional, so 2.99 means "almost certainly the fourth level". `level` is the most likely label (on a tie, the lower one), so you don't have to round `score` yourself. `probabilities` has one entry per level, keyed by label.

`confidence` is the provider's own measure of how sure it is, from 0 to 1. Each provider calculates it differently, so compare it within one provider, not across providers. When a provider leaves an option or level out of its probabilities, it's filled in as 0, so every key is always there.

`usage` reports `inputTokens`, and `outputTokens` when the provider reports it.

### Refusals

OpenAI can decline to answer one question and still answer the rest. That answer comes back as `{ type: "refusal" }`, so check for it before reading the answer:

```ts
const team = result.answers.team;

if (team.type === "refusal") {
  // send it to a person instead
} else {
  route(team.choice); // "billing" | "technical"
}
```

TypeScript requires the check. `team.choice` is a compile error until you've ruled out the refusal.

## Types

Answer types come from your questions. You don't need `as const`:

- `result.answers.team.choice` is `"billing" | "technical"`.
- `result.answers.severity.level` is `"None" | "Minor" | "Major" | "Critical"`.
- `result.answers.priority` is a compile error, because there's no `priority` question.

To name the result type, use the executor:

```ts
type TriageResult = Awaited<ReturnType<typeof triage.execute>>;
```

## Input

`execute({ input })` takes the thing the questions are about:

- a string, or
- a plain JSON object or array, such as a ticket record. Providers receive it as JSON, not as text.

Anything else (a number, `null`, a `Date`, a `Map`) throws before a request is sent.

## Checks Before Sending

`createDecisionExecutor` checks your questions when you create it, so a mistake fails right away instead of costing a request. It throws an `LlmExeError` with code `configuration.incompatible_options`, and `context.option` says which question is wrong:

```ts
createDecisionExecutor(model, {
  severity: { type: "score", instructions: "How bad?", levels: ["Only one"] },
});
// LlmExeError: Score question "severity" needs 2 to 10 levels.
// err.context.option === "questions.severity.levels"
```

It also checks the question count against the provider's limit: 400 for OpenAI and TypeSafe, 64 for Clef.

## Errors and Retries

The decision executor uses the same request handling as [`useLlm`](/llm/), so `timeout`, `maxDelay`, `numOfAttempts` and `jitter` work the same way. Pass them to `useDecisionModel`:

```ts
const model = useDecisionModel("typesafe.jev", {
  timeout: 10_000,
  numOfAttempts: 3,
});
```

| Error code | When | Retried |
|------------|------|---------|
| `configuration.incompatible_options` | A question is invalid (see above). | No |
| `configuration.missing_option` | A required option is missing, like `model` for `openai.decisions.v1` or `cloudflareAccountId` for Clef. Thrown by `useDecisionModel`. | No |
| `configuration.invalid_provider` | The model key doesn't exist. | No |
| `prompt.missing_input` | `input` isn't a string, plain object, or array. | No |
| `llm.provider_rate_limited` | The provider returned 429. | Yes |
| `llm.provider_unavailable` | The provider returned 408 or a 5xx. | Yes |
| `llm.provider_invalid_request` | The provider rejected the request (400 or 422). | No |
| `llm.provider_auth_failed` | The API key or token was rejected (401 or 403). | No |
| `llm.invalid_response_shape` | The response doesn't answer every question in the expected shape. | No, because a retry would most likely get the same response and be billed again. |

## Hooks and Metadata

A decision executor is a regular executor, so [hooks](/executor/hooks) work as usual:

```ts
const triage = createDecisionExecutor(model, questions, {
  name: "ticket-triage",
  hooks: {
    onSuccess: (metadata) => console.log("triaged", metadata.output),
    onError: (metadata) => console.error("triage failed", metadata.error),
  },
});
```

`triage.getMetadata()` includes the executor's name, the question names, and the model's settings and call counts. API keys and tokens are never included.

## Not Supported Yet

- Images as input.
- TypeSafe's `box` question type (image bounding boxes).
- A chat history ([Dialogue](/state/dialogue)) as input.
- Streaming.
