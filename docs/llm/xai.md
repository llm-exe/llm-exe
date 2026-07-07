---
title: "Use xAI Grok Models in TypeScript with llm-exe"
description: "Call xAI Grok models like grok-4 and grok-3-mini from TypeScript with llm-exe. Covers typed model shorthands, API key setup, and xAI-specific options."
---

# xAI

When using xAI models, llm-exe will make POST requests to `https://api.x.ai/v1/chat/completions`. All models are supported if you pass `xai.chat.v1` as the first argument, and then specify a model in the options.

llm-exe ships typed shorthands for the most common xAI models so you do not have to remember the exact model strings:

| Shorthand                  | Default model                       |
| -------------------------- | ----------------------------------- |
| `xai.chat.v1`              | _none — set `model`_                |
| `xai.grok-2`               | `grok-2-latest`                     |
| `xai.grok-3`               | `grok-3`                            |
| `xai.grok-3-mini`          | `grok-3-mini`                       |
| `xai.grok-4`               | `grok-4`                            |
| `xai.grok-4-fast`          | `grok-4-fast-non-reasoning`         |
| `xai.grok-4-1-fast`        | `grok-4-1-fast-non-reasoning`       |
| `xai.grok-4.3`             | `grok-4.3` (reasoning model)        |
| `xai.grok-4.20`            | `grok-4.20-0309-non-reasoning`      |
| `xai.grok-4.20-reasoning`  | `grok-4.20-0309-reasoning`          |

## Basic Usage

### xAI Chat

```ts
const llm = useLlm("xai.chat.v1", {
  model: "grok-4", // specify a model
});
```

### x.ai Chat By Model

```ts
const llm = useLlm("xai.grok-4", {
  // other options,
  // no model needed, using grok-4
});
```

```ts
const llm = useLlm("xai.grok-3-mini", {
  // other options,
  // no model needed, using grok-3-mini
});
```

<ImportModelNames provider="xai" />

## Authentication

To authenticate, you need to provide an xAI API Key. You can provide the API key various ways, depending on your use case.

1. Pass in as execute options using `xAiApiKey`
2. Pass in as setup options using `xAiApiKey`
3. Use a default key by setting an environment variable of `XAI_API_KEY`

Generally you pass the LLM instance off to an LLM Executor and call that. However, it is possible to interact with the LLM object directly, if you wanted.

```ts
// call the LLM directly with a prompt
await llm.call(prompt);
```

## xAI-Specific Options

In addition to the generic options, the following options are xAI-specific and can be passed in when creating a llm function.

| Option           | Type    | Default     | Description                                                    |
| ---------------- | ------- | ----------- | -------------------------------------------------------------- |
| model            | string  | —           | The model to use. Must be specified when using `xai.chat.v1`.  |
| xAiApiKey        | string  | undefined   | API key for xAI. Optionally can be set using process.env.XAI_API_KEY |
| topP             | number  | undefined   | Maps to `top_p`. See xAI Docs                                 |
| stopSequences    | array   | undefined   | Maps to `stop`. See xAI Docs                                  |
| frequencyPenalty | number  | undefined   | Maps to `frequency_penalty`. See xAI Docs                     |
| logitBias        | object  | undefined   | Maps to `logit_bias`. See xAI Docs                            |
| useJson          | boolean | undefined   | When `true`, sets `response_format` to `json_object`           |
| effort           | string  | undefined   | Maps to `reasoning_effort`. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Currently not supported by any available xAI model and will be silently ignored. |

See [xAI API Reference](https://docs.x.ai/docs/overview) for details on these parameters.
