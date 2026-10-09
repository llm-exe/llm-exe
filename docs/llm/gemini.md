---
title: "Use Google Gemini Models in TypeScript with llm-exe"
description: "Call Google Gemini models like gemini-3.5-flash from TypeScript with llm-exe. Covers setup, API key authentication, and Gemini-specific options like effort."
---

# Google Gemini

When using Google Gemini models, llm-exe will make POST requests to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. All models are supported if you pass `google.chat.v1` as the first argument, and then specify a model in the options.

llm-exe ships typed shorthands for the most common Gemini models so you do not have to remember the exact model strings:

| Shorthand                      | Default model            |
| ------------------------------ | ------------------------ |
| `google.chat.v1`               | _none — set `model`_     |
| `google.gemini-3.1-flash-lite` | `gemini-3.1-flash-lite`  |
| `google.gemini-3.5-flash`      | `gemini-3.5-flash`       |
| `google.gemini-3.5-flash-lite` | `gemini-3.5-flash-lite`  |
| `google.gemini-3.6-flash`      | `gemini-3.6-flash`       |
| `google.gemini-3.7-flash`      | `gemini-3.7-flash`       |

### Deprecated shorthands

These shorthands still resolve, but emit a [deprecation warning](/llm/deprecations)
when used. Migrate to an active shorthand above.

| Shorthand                      | Default model           | Status                                                     |
| ------------------------------ | ----------------------- | ---------------------------------------------------------- |
| `google.gemini-2.5-pro`        | `gemini-2.5-pro`        | Deprecated by Google — shuts down 2026-06-17                |
| `google.gemini-2.5-flash`      | `gemini-2.5-flash`      | Deprecated by Google — shuts down 2026-06-17                |
| `google.gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | Deprecated by Google — shuts down 2026-07-22                |
| `google.gemini-2.0-flash`      | `gemini-2.0-flash`      | Shut down on 2026-06-01 — requests will fail at the API      |
| `google.gemini-2.0-flash-lite` | `gemini-2.0-flash-lite` | Shut down on 2026-06-01 — requests will fail at the API      |
| `google.gemini-1.5-pro`        | `gemini-1.5-pro`        | Shut down on 2025-09-29 — requests will fail at the API      |

## Basic Usage

### Gemini Chat

```ts
const llm = useLlm("google.chat.v1", {
  model: "gemini-3.5-flash", // specify a model
});
```

### Gemini Chat By Model

```ts
const llm = useLlm("google.gemini-3.5-flash", {
  // other options,
  // no model needed, using gemini-3.5-flash
});
```

<ImportModelNames provider="google" />

## Authentication

To authenticate, you need to provide a Google Gemini API Key. You can provide the API key various ways, depending on your use case.

1. Pass in as execute options using `geminiApiKey`
2. Pass in as setup options using `geminiApiKey`
3. Use a default key by setting an environment variable of `GEMINI_API_KEY`

Generally you pass the LLM instance off to an LLM Executor and call that. However, it is possible to interact with the LLM object directly, if you wanted.

```ts
// call the LLM directly with a prompt
await llm.call(prompt);
```

## Gemini-Specific Options

In addition to the generic options, the following options are Gemini-specific and can be passed in when creating a llm function.

| Option       | Type   | Default          | Description                                                          |
| ------------ | ------ | ---------------- | -------------------------------------------------------------------- |
| model        | string | —                | The model to use. Must be specified when using `google.chat.v1`. See Google Gemini Docs |
| geminiApiKey | string | undefined        | API key for Google. See [authentication](/llm/gemini#authentication) |
| effort       | string | undefined        | Maps to `thinkingConfig.thinkingBudget`. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Only sent for `gemini-2.5-pro`, `gemini-2.5-flash`, and `gemini-2.5-flash-lite`; on any other model, or for a value outside that list, it is silently dropped. |

::: warning `effort` and the Gemini 3.x shorthands
The model list `effort` checks against covers only the three 2.5 models above —
all of which are deprecated. That means `effort` is currently **dropped** on
every active shorthand (`google.gemini-3.1-flash-lite`, `google.gemini-3.5-flash`,
`google.gemini-3.5-flash-lite`, `google.gemini-3.6-flash`,
`google.gemini-3.7-flash`). There is no error or warning — the request simply
goes out without `thinkingConfig.thinkingBudget`.

Tracked in [llm-exe#781](https://github.com/llm-exe/llm-exe/issues/781).
:::

> [!NOTE]
> The Gemini provider currently maps `model`, `geminiApiKey`, and `effort`. Generic options like `temperature`, `maxTokens`, and `topP` are not mapped to the Gemini API at this time.

See [Google Gemini API Reference](https://ai.google.dev/gemini-api/docs) for details.
