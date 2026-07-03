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

In addition to the [generic options](/llm/generic.html), the following options are available for Anthropic models on Bedrock.

| Option      | Type   | Default   | Description                                                              |
| ----------- | ------ | --------- | ------------------------------------------------------------------------ |
| model       | string | —         | The Bedrock model id. Must be specified. See AWS Bedrock Docs            |
| maxTokens   | number | 10000     | Maps to `max_tokens`. See Anthropic Docs                                 |
| topP        | number | undefined | Maps to `top_p`. See Anthropic Docs                                      |
| awsRegion   | string | undefined | AWS Region. Can be set via `AWS_REGION` environment variable             |
| awsSecretKey| string | undefined | AWS Secret Key. Can be set via `AWS_SECRET_ACCESS_KEY` environment variable |
| awsAccessKey| string | undefined | AWS Access Key. Can be set via `AWS_ACCESS_KEY_ID` environment variable  |

> [!NOTE]
> The Bedrock Anthropic provider maps a subset of the direct [Anthropic provider](/llm/anthropic.html) options. Options like `temperature`, `topK`, `stopSequences`, `metadata`, and `serviceTier` are not mapped for the Bedrock variant at this time.