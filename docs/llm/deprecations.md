---
title: Deprecation Warnings | llm-exe
description: "Reference for deprecated provider and model shorthand warnings."
---

# Deprecation Warnings

Some provider or model shorthands continue to resolve but are marked as deprecated. When a deprecated shorthand is used, llm-exe emits a Node warning.

```ts
const llm = useLlm("openai.o4-mini");
await llm.call("hello");
```

The warning uses:

```ts
{
  type: "DeprecationWarning",
  code: "LLM_EXE_DEPRECATED"
}
```

The warning detail includes:

```ts
{
  shorthand: string;
  model?: string;
  provider: string;
  executorName?: string;
  traceId?: string;
}
```

Warnings are emitted once per deprecated shorthand in the current process.

## Handling Warnings

In Node, you can listen for warnings:

```ts
process.on("warning", (warning) => {
  if (warning.code === "LLM_EXE_DEPRECATED") {
    console.warn(warning.message);
    console.warn(warning.detail);
  }
});
```

Deprecated model shorthands still appear in generated provider model lists. Prefer an active shorthand, or use the base provider key with an explicit model:

```ts
const llm = useLlm("openai.chat.v1", {
  model: "gpt-4o-mini",
});
```
