---
title: "Get a Yes/No Decision from an LLM in TypeScript | llm-exe"
description: "Turn an LLM into a typed boolean function in TypeScript: ask a question, parse the answer as true or false, and branch on it with no string checking."
---

## Yes/No Decisions

Sometimes you don't need a paragraph from an LLM — you need a boolean. "Does this comment contain a question?" "Is this ticket urgent?" "Should this PR run the expensive test suite?" This recipe builds a function that asks the LLM a question and returns an actual `true` or `false`, so the calling code can branch on it directly.

The key is the [boolean parser](/parser/included-parsers): it converts the model's text answer ("yes", "No.", "true") into a real boolean, and throws if the response doesn't contain one — so your `if` statement never runs on a malformed answer.

#### Step 1 - Imports

<<< ../../../examples/yesNoDecision.ts#imports

#### Step 2 - Prepare Prompt

The prompt does two jobs: it asks the question, and it constrains the answer format. Telling the model it *must* answer yes or no (even when unsure) avoids hedged responses that can't be parsed.

<<< ../../../examples/yesNoDecision.ts#prompt

#### Step 3 - Create the Function

The parser is `boolean` with `match: "extract"`, which finds a yes/no/true/false token inside the response even if the model adds punctuation or stray words. If the response contains no boolean — or contains both a yes *and* a no — the parser throws instead of guessing.

<<< ../../../examples/yesNoDecision.ts#function

#### Step 4 - Use it!

```typescript
import { yesNo } from "./somewhere";

if (await yesNo("Does this comment contain a question?")) {
  await routeToSupport(comment);
}

const shouldRunE2e = await yesNo(
  `Based on these changed files, could this PR affect the checkout flow?\n${changedFiles.join("\n")}`
);
```

Because the executor's return type is inferred from the parser, `yesNo` is a `Promise<boolean>` — no casting, no `.toLowerCase().includes("yes")` string checks.

### Where this pattern fits

- **Pre-checks and gating** — decide whether to run an expensive step (moderation review, e2e tests, human escalation)
- **Content filtering** — "does this message need a disclaimer?", "is this on-topic?"
- **Input screening** — a first-pass gate on untrusted input; for the full fail-closed pattern see [Prompt Injection Screening](/examples/concepts/prompt-injection-screening)
- **Workflow conditions** — a typed boolean drops straight into `if:` conditions in CI or any orchestration code

For decisions with more than two outcomes, use the same shape with a category parser instead — see [Intent Classification](/examples/bots/intent) and [Conditional Logic and Branching](/examples/chains/conditional-logic-with-llms).

### Related

- [Included Parsers](/parser/included-parsers) — the boolean parser and its options
- [Conditional Logic and Branching](/examples/chains/conditional-logic-with-llms) — routing on multi-category LLM output
- [Add Retries and Timeouts](/examples/concepts/retries-and-timeouts) — make decisions like this production-safe
- [Error Handling](/misc/errors) — what the parser throws when no boolean is found
