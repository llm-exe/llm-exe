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
| effort           | string  | undefined   | Maps to `reasoning_effort`. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Only supported with reasoning models (e.g. gpt-5). |

See [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat) for details on these parameters.
