---
title: "Keep Prompts Out of Your Business Logic | llm-exe"
description: "Separate prompt templates from application code in TypeScript: typed template variables, prompts you can review and test without an API call, and clean diffs."
---

## Separate Prompts from Business Logic

Inline prompt strings rot fast: they get concatenated with data, edited mid-function, and eventually nobody can tell what the model actually receives. The fix is the same one templating solved for HTML twenty years ago — the prompt is a template that declares its variables, and business logic just supplies data.

#### Step 1 - Imports

<<< ../../../examples/promptSeparation.ts#imports

#### Step 2 - Prompts Live with Prompts

The template is a plain exported constant — it can live in its own module, be reviewed in isolation, and produce clean diffs when prompt wording changes (no application code touched). The Handlebars variables declare exactly what data it needs.

<<< ../../../examples/promptSeparation.ts#prompts

#### Step 3 - Business Logic Supplies Data

The prompt's input type is enforced by the generic: forget `companyName` or pass a number and it's a compile error, not a prompt with a hole in it.

<<< ../../../examples/promptSeparation.ts#function

#### Step 4 - Test Prompts Without an API Call

Because the prompt is data, you can render it and assert on the result — no LLM call, no API key, no cost. This runs in your normal test suite:

<<< ../../../examples/promptSeparation.ts#testing

```typescript
const rendered = renderSupportReplyPrompt({
  companyName: "Acme",
  message: "My widget arrived broken.",
});
// assert the exact text the model will see — snapshot it, lint it, review it
```

### Where to keep prompts as you scale

1. **Exported constants** (this recipe) — right for most apps; prompts are versioned in git next to the code that uses them.
2. **A dedicated prompts module** — one directory, all templates, easy to audit what your app says to models.
3. **Loaded at runtime** — fetch templates from S3 or a CMS when non-engineers edit prompts or you want to change wording without deploying. See [Loading Prompts Remotely](/examples/prompt/load-remote).

The executor code is identical in all three — only where the template string comes from changes.

### Related

- [Prompts](/prompt/) — chat and text prompt reference
- [Advanced Templates](/prompt/advanced) — partials, conditionals, and loops with Handlebars
- [Loading Prompts Remotely](/examples/prompt/load-remote) — runtime-loaded templates
- [Write a Type-Safe LLM Function](/examples/concepts/type-safe-llm-function) — typing the output side too
