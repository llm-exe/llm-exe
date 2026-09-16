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
| model        | string | —         | The Bedrock model id, cross-region inference profile id, or a full ARN. Must be specified. See the model identifiers note below, and the AWS Bedrock Docs |
| maxTokens    | number | 10000     | Maps to `max_tokens`. Raised to 65536 when unset on the escalated effort path (Opus 4.7 / 4.8 high). See the effort note below. |
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
> **Timeout on the escalated path:** the raised 65536 ceiling can let an `xhigh` run exceed the default 30000ms `timeout` (llm-exe does not stream), and timeouts are retried (default `numOfAttempts` 2), costing a second billed attempt. Raise `timeout` when using `effort: "high"` on Opus 4.7 / 4.8.
>
> Because `effort` enables thinking, and Anthropic disallows sampling parameters while thinking is active, llm-exe drops `topP` below `0.95` whenever `effort` enables thinking (and drops `temperature` / `topK` on the direct provider, which maps them). Pass `topP >= 0.95` if you need it. This applies to the direct provider as well.
>
> **Model identifiers:** `model` accepts three forms, and llm-exe URL-encodes it into the invoke path, so identifiers containing `/` or `:` route correctly:
>
> ```ts
> // 1. Foundation model id
> useLlm("amazon:anthropic.chat.v1", { model: "anthropic.claude-sonnet-4-v2:0" });
>
> // 2. Cross-region inference profile id — the usual form for newer models
> useLlm("amazon:anthropic.chat.v1", { model: "us.anthropic.claude-sonnet-4-v2:0" });
>
> // 3. Full ARN
> useLlm("amazon:anthropic.chat.v1", {
>   model: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-sonnet-4-v2:0",
> });
> ```
>
> The geographic prefix (`us.`, `eu.`, `apac.`, `us-gov.`) is understood, so a cross-region profile is gated for `effort` exactly like the bare foundation model id.
>
> **ARN types and `effort` (easy to miss):** the model-specific behavior below — `effort` / `thinking`, the Opus 4.7 / 4.8 escalation, and the `topP` drop — is selected by matching the Claude model name. llm-exe can recover that name from an `inference-profile/` or `foundation-model/` ARN, because those embed the model id. The other ARN types (`provisioned-model/`, `custom-model/`, `application-inference-profile/`) carry an **opaque** id, so no gate matches: the request is still dispatched, but `effort` is silently ignored and `topP` is not dropped. If you point at a provisioned throughput or application inference profile ARN and need this behavior, pass the tuning options explicitly rather than relying on `effort`.
>
> **Forced `tool_choice`:** `functionCall: "any"` (or a named tool) is incompatible with extended thinking (the 4.5 `enabled` path) on both providers, and llm-exe throws a clear error for it. Note Bedrock additionally rejects a forced `tool_choice` with **adaptive** thinking — which the direct API accepts — so combining `effort` with `functionCall: "any"` on an adaptive model returns a 400 from Bedrock; use `functionCall: "auto"` there.
