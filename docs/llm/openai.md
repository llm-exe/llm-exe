---
title: "Use OpenAI Models in TypeScript with llm-exe"
description: "Call OpenAI chat models like gpt-4o and gpt-4o-mini from TypeScript with llm-exe, with typed options, API key setup, retries, and JSON response mode."
---

# OpenAI

When using OpenAi models, llm-exe will make POST requests to `https://api.openai.com/v1/chat/completions`. All models are supported if you pass `openai.chat.v1` as the first argument, and then specify a model in the options.

## Basic Usage

### OpenAi Chat

```ts
const llm = useLlm("openai.chat.v1", {
  model: "gpt-4o", // specify a model
});
```

### OpenAi Chat By Model

```ts
const llm = useLlm("openai.gpt-4o", {
  // other options,
  // no model needed, using gpt-4o
});
```

<ImportModelNames provider="openai" />

## Authentication

To authenticate, you need to provide an OpenAi API Key. You can provide the API key various ways, depending on your use case.

1. Pass in as execute options using `openAiApiKey`
2. Pass in as setup options using `openAiApiKey`
3. Use a default key by setting an environment variable of `OPENAI_API_KEY`

Generally you pass the LLM instance off to an LLM Executor and call that. However, it is possible to interact with the LLM object directly, if you wanted.

```ts
// call the LLM directly with a prompt
await llm.call(prompt);
```

## OpenAi-Specific Options

In addition to the [generic options](/llm/generic), the following options are OpenAi-specific and can be passed in when creating a llm function.

| Option           | Type    | Default     | Description                                                    |
| ---------------- | ------- | ----------- | -------------------------------------------------------------- |
| model            | string  | —           | The model to use. Must be specified when using `openai.chat.v1`. Can be any valid chat model. See OpenAI Docs |
| openAiApiKey     | string  | undefined   | API key for OpenAi. See [authentication](/llm/openai#authentication)   |
| topP             | number  | undefined   | Maps to `top_p`. See OpenAI Docs                               |
| stopSequences    | array   | undefined   | Maps to `stop`. See OpenAI Docs                                |
| frequencyPenalty | number  | undefined   | Maps to `frequency_penalty`. See OpenAI Docs                   |
| logitBias        | object  | undefined   | Maps to `logit_bias`. See OpenAI Docs                          |
| useJson          | boolean | undefined   | When `true`, sets `response_format` to `json_object`           |
| effort           | string  | undefined   | Maps to `reasoning_effort`. Valid values: `"none"`, `"minimal"`, `"low"`, `"medium"`, `"high"`. Only sent for OpenAI reasoning models — any model whose name starts with `gpt-5`, `o3`, or `o4`; on any other model, or for a value outside that list, it is silently dropped. `"none"` is accepted by gpt-5.1 and later; the original `gpt-5`, `gpt-5-mini`, and `gpt-5-nano` reject it. |

See [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat) for details on these parameters.

::: warning Reasoning models (`gpt-5*`, `o3*`, `o4*`) rewrite `maxTokens`, `temperature`, and `topP`
OpenAI's reasoning models reject the legacy Chat Completions parameters, so llm-exe adjusts the request for any model whose name starts with `gpt-5`, `o3`, or `o4`:

- **`maxTokens` is sent as `max_completion_tokens`** instead of `max_tokens`. Reasoning models return a 400 on `max_tokens` (`Use 'max_completion_tokens' instead`). Non-reasoning models (`gpt-4o`, `gpt-4.1`, ...) still receive `max_tokens`.
- **`temperature` and `topP` are dropped unless `effort` is `"none"`.** Reasoning models only accept the default sampling values while reasoning is active; gpt-5.5 and gpt-5.6 reject them even when `reasoning_effort` is omitted. Pass `effort: "none"` on gpt-5.1 or later to keep them.

Both rules are specific to the OpenAI provider. The xAI and DeepSeek providers, which share the same mapper, forward these parameters unchanged.
:::
