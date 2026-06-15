---
title: Prompt Validation | llm-exe
description: "Validate prompt template inputs before rendering."
---

# Prompt Validation

Prompt validation checks that prompt input contains the variables referenced by the prompt templates.

```ts
import { createChatPrompt, isLlmExeError } from "llm-exe";

const prompt = createChatPrompt<{ name: string }>("Hello {{name}}");

try {
  prompt.validate({});
} catch (error) {
  if (isLlmExeError(error, "prompt.missing_template_variable")) {
    console.log(error.context?.missingVariables);
  }
}
```

`validate(input)` does not render the prompt or call registered helpers. It only checks template references against the input object.

## Strict Mode

Set `validateInput: "strict"` to validate before `format()` or `formatAsync()`.

```ts
const prompt = createChatPrompt<{ name: string }>("Hello {{name}}", {
  validateInput: "strict",
});

prompt.format({});
// throws LlmExeError with code "prompt.missing_template_variable"
```

Use strict mode when a missing prompt variable should throw before calling the LLM.

## Warn Mode

Set `validateInput: "warn"` to emit a Node warning and continue rendering.

```ts
const prompt = createChatPrompt<{ name: string }>("Hello {{name}}", {
  validateInput: "warn",
});

prompt.format({});
```

Warn mode uses `process.emitWarning` when available. In runtimes without `process.emitWarning`, rendering continues without a warning.

## Default Behavior

By default, `validateInput` is `false`.

```ts
const prompt = createChatPrompt("Hello {{name}}");
prompt.format({});
```

This keeps the default prompt rendering behavior.

## Missing Helpers

Validation also reports helper names that appear in templates but are not registered.

```ts
const prompt = createChatPrompt("{{unknownHelper input}}", {
  validateInput: "strict",
});

prompt.format({ input: "hello" });
// throws prompt.missing_template_variable
```

The error context contains:

```ts
{
  missingVariables: string[];
  missingHelpers: string[];
}
```

## Prompt Existence

`validate(input)` validates template references. To check whether a prompt has messages, inspect `messages` directly:

```ts
const hasMessages = prompt.messages.length > 0;
```
