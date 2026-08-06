---
title: "Use Anthropic Claude on AWS Bedrock | llm-exe"
description: "Run Anthropic Claude models on AWS Bedrock from TypeScript with llm-exe. Covers Bedrock model IDs, AWS authentication, and supported Claude options."
---

# Anthropic

When using Anthropic models via AWS Bedrock, llm-exe will make POST requests to `https://bedrock-runtime.us-west-2.amazonaws.com/model/{MODEL_ID}/invoke`.

## Setup

### Anthropic Chat

```ts
const llm = useLlm("amazon:anthropic.chat.v1", {
  model: "anthropic.claude-sonnet-4-v2:0",  // This is the model id from Bedrock
});
```

## Bedrock Anthropic Options

In addition to the [generic options](/llm/generic), the following options are available for Anthropic models on Bedrock.

| Option       | Type   | Default   | Description                                                                 |
| ------------ | ------ | --------- | --------------------------------------------------------------------------- |
| model        | string | —         | The Bedrock model id. Must be specified. See AWS Bedrock Docs               |
| maxTokens    | number | 10000     | Maps to `max_tokens`. See Anthropic Docs                                    |
| topP         | number | undefined | Maps to `top_p`. Dropped for reject models, or `< 0.95` under `effort`.     |
| effort       | string | undefined | Maps to `output_config.effort` + `thinking`. See Anthropic provider.        |
| awsRegion    | string | undefined | AWS Region. Can be set via `AWS_REGION` environment variable                |
| awsSecretKey | string | undefined | AWS Secret Key. Can be set via `AWS_SECRET_ACCESS_KEY` environment variable |
| awsAccessKey | string | undefined | AWS Access Key. Can be set via `AWS_ACCESS_KEY_ID` environment variable     |

> [!NOTE]
> The Bedrock Anthropic provider maps a subset of the direct [Anthropic provider](/llm/anthropic) options. `temperature`, `topK`, `stopSequences`, `metadata`, and `serviceTier` are not mapped for the Bedrock variant at this time.
>
> **`effort` and sampling params:** `effort` maps to `output_config.effort` and adaptive/extended `thinking`, identical to the direct provider, including the Opus 4.7 / 4.8 `high` -> `xhigh` escalation, which raises the default `max_tokens` to 65536 when you do not set it. `topP` is dropped for the models that 400 on sampling parameters (Opus 4.7, 4.8, and 5; Sonnet 5; Fable 5).
>
> Because `effort` enables thinking, and Anthropic disallows sampling parameters while thinking is active, llm-exe drops `topP` below `0.95` whenever `effort` enables thinking (and drops `temperature` / `topK` on the direct provider, which maps them). Pass `topP >= 0.95` if you need it. This applies to the direct provider as well.
>
> **Forced `tool_choice`:** `functionCall: "any"` (or a named tool) is incompatible with extended thinking (the 4.5 `enabled` path) on both providers, and llm-exe throws a clear error for it. Note Bedrock additionally rejects a forced `tool_choice` with **adaptive** thinking — which the direct API accepts — so combining `effort` with `functionCall: "any"` on an adaptive model returns a 400 from Bedrock; use `functionCall: "auto"` there.
