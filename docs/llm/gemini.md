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
| effort       | string | undefined        | Maps to `generationConfig.thinkingConfig.thinkingBudget`. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`, sent as budgets of 1024, 1024, 8192, and 24576 tokens. Sent for every Gemini 2.5 or later model, including all the 3.x shorthands; dropped on earlier models or for a value outside that list. |

> [!NOTE]
> Besides `model`, `geminiApiKey`, and `effort`, the Gemini provider maps the [generic options](/llm/generic) `temperature`, `topP`, `maxTokens` (sent as `maxOutputTokens`), and `stopSequences`, all under `generationConfig`.

See [Google Gemini API Reference](https://ai.google.dev/gemini-api/docs) for details.
