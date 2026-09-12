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
| `xai.grok-4.3`             | `grok-4.3` (reasoning model)        |
| `xai.grok-4.20`            | `grok-4.20-0309-non-reasoning`      |
| `xai.grok-4.20-reasoning`  | `grok-4.20-0309-reasoning`          |
| `xai.grok-4.5`             | `grok-4.5` (reasoning model)        |
| `xai.grok-4.6`             | `grok-4.6` (reasoning model)        |

### Deprecated shorthands

These shorthands still resolve, but emit a [deprecation warning](/llm/deprecations) when used. Migrate to `xai.grok-4.3` (or another active shorthand above).

| Shorthand           | Default model                 | Status                                                                     |
| ------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `xai.grok-3`        | `grok-3`                      | Retired by xAI on 2026-05-15 — xAI redirects the request to `grok-4.3`.     |
| `xai.grok-4-fast`   | `grok-4-fast-non-reasoning`   | Retired by xAI on 2026-05-15 — xAI redirects the request to `grok-4.3`.     |
| `xai.grok-4-1-fast` | `grok-4-1-fast-non-reasoning` | Retired by xAI on 2026-05-15 — xAI redirects the request to `grok-4.3`.     |
| `xai.grok-2`        | `grok-2-latest`               | No longer served by xAI — requests using it will fail at the API.           |
| `xai.grok-3-mini`   | `grok-3-mini`                 | Delisted by xAI — no longer a current model.                                |
| `xai.grok-4`        | `grok-4`                      | Delisted by xAI — no longer a current model.                                |

The delisted shorthands (`xai.grok-2`, `xai.grok-3-mini`, `xai.grok-4`) are kept only so existing code warns instead of failing silently, and are slated for removal in the next major release.

## Basic Usage

### xAI Chat

```ts
const llm = useLlm("xai.chat.v1", {
  model: "grok-4.3", // specify a model
});
```

### x.ai Chat By Model

```ts
const llm = useLlm("xai.grok-4.3", {
  // other options,
  // no model needed, using grok-4.3
});
```

```ts
const llm = useLlm("xai.grok-4.20", {
  // other options,
  // no model needed, using grok-4.20-0309-non-reasoning
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
| effort           | string  | undefined   | Maps to `reasoning_effort`. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Only sent for xAI reasoning models (`grok-4.3`, `grok-4.5`, `grok-4.6`); on any other model, or for a value outside that list, it is silently dropped. |

::: warning `effort` and `xai.grok-4.20-reasoning`
Despite the shorthand name, `xai.grok-4.20-reasoning` (which resolves to
`grok-4.20-0309-reasoning`) is **not** currently treated as a reasoning model by
llm-exe, so `effort` is dropped rather than sent as `reasoning_effort`. There is
no error or warning — the request simply goes out without the parameter.

Tracked in [llm-exe#732](https://github.com/llm-exe/llm-exe/issues/732). If you
need `reasoning_effort` on that model today, use `xai.grok-4.3`, `xai.grok-4.5`,
or `xai.grok-4.6`.
:::

See [xAI API Reference](https://docs.x.ai/docs/overview) for details on these parameters.
