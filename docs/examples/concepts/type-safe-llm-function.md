---
title: "Write a Type-Safe LLM Function in TypeScript | llm-exe"
description: "Build an LLM call that behaves like a normal typed TypeScript function: schema-validated JSON in, an inferred return type out, and no any or manual casting."
---

## A Type-Safe LLM Function

Raw LLM SDK calls give you a string and a shrug: `JSON.parse` the response, cast it to `any`, and hope. This recipe builds an LLM call that behaves like a regular typed function — you define the output shape once as a schema, and TypeScript infers the return type from it. If the model returns something that doesn't match, the call throws instead of letting bad data flow downstream.

#### Step 1 - Imports

<<< ../../../examples/typeSafeLlmFunction.ts#imports

#### Step 2 - Define the Output Schema

`defineSchema` does double duty: at runtime it validates the model's response, and at compile time it becomes the function's return type via inference. The `description` fields aren't decoration — they're rendered into the prompt so the model knows what each field means.

<<< ../../../examples/typeSafeLlmFunction.ts#schema

#### Step 3 - Prepare the Prompt

The `JsonSchema` partial (the `>JsonSchema key='schema'` line in the template below) renders the schema into the prompt as formatting instructions, so the prompt and the validator can never drift apart — they're the same object.

<<< ../../../examples/typeSafeLlmFunction.ts#prompt

#### Step 4 - Create the Function

<<< ../../../examples/typeSafeLlmFunction.ts#function

#### Step 5 - Use it!

```typescript
const analysis = await analyzeReview(
  "Arrived two weeks late and the box was crushed. Product works though."
);

// All of this is inferred — no casts, no `any`:
analysis.sentiment;    // "positive" | "neutral" | "negative"
analysis.summary;      // string
analysis.actionNeeded; // boolean

if (analysis.actionNeeded) {
  await createSupportTicket(analysis.summary);
}
```

Rename `actionNeeded` in the schema and every usage becomes a compile error. That's the point: changes to the LLM contract surface in `tsc`, not in production.

### Why this beats parse-and-cast

- **One source of truth.** The schema is the prompt instructions, the runtime validator, and the TypeScript type. There is no second place to update.
- **Failures are loud.** A malformed or off-schema response throws an `LlmExeError` — it can't silently become `undefined` three modules later.
- **The function is testable.** It's just an async function with a typed input and output; mock it like anything else.

### Related

- [Working With JSON](/examples/concepts/working-with-json.html) — more patterns for reliable JSON output
- [Extract Structured Data](/examples/bots/extract.html) — caller-supplied schemas for slot filling
- [Parsers](/parser/index.html) — how parser output types flow into executor return types
- [Add Retries and Timeouts](/examples/concepts/retries-and-timeouts.html) — production hardening for functions like this
