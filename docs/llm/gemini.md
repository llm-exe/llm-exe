---
title: "Use Google Gemini Models in TypeScript with llm-exe"
description: "Call Google Gemini models like gemini-3.5-flash from TypeScript with llm-exe. Covers setup, API key authentication, and Gemini-specific options like effort."
---

# Google Gemini

When using Google Gemini models, llm-exe will make POST requests to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`. All models are supported if you pass `google.chat.v1` as the first argument, and then specify a model in the options.

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
| effort       | string | undefined        | Maps to `thinkingConfig.thinkingBudget` (`minimal`/`low` → 1024, `medium` → 8192, `high` → 24576). Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Only sent for `gemini-2.5-pro`, `gemini-2.5-flash`, and `gemini-2.5-flash-lite`; on any other model, or for a value outside that list, it is silently dropped. |

::: warning `effort` and the Gemini 3.x models
The models `effort` currently supports (`gemini-2.5-pro`, `gemini-2.5-flash`,
`gemini-2.5-flash-lite`) are all reachable only through
[deprecated shorthands](./deprecations.md). On the current `google.gemini-3.*`
shorthands, `effort` is dropped rather than sent as
`thinkingConfig.thinkingBudget` — there is no error or warning, the request
simply goes out without the parameter.

Tracked in [llm-exe#781](https://github.com/llm-exe/llm-exe/issues/781).
:::

> [!NOTE]
> The Gemini provider maps `model`, `geminiApiKey`, `effort`, and the generic
> `temperature`, `topP`, `maxTokens`, and `stopSequences` options (to
> `generationConfig.temperature`, `generationConfig.topP`,
> `generationConfig.maxOutputTokens`, and `generationConfig.stopSequences`).
> Other generic options are not sent to the Gemini API at this time.

See [Google Gemini API Reference](https://ai.google.dev/gemini-api/docs) for details.
