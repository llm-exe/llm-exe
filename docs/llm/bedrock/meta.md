---
title: "Use Meta Llama on AWS Bedrock in TypeScript | llm-exe"
description: "Run Meta Llama models on AWS Bedrock from TypeScript with llm-exe. Covers Bedrock model IDs, AWS credentials, and Llama-specific options like maxTokens."
---

# Meta

When using Meta models via AWS Bedrock, llm-exe will make POST requests to `https://bedrock-runtime.us-west-2.amazonaws.com/model/{MODEL_ID}/invoke`.

## Setup

### Meta LLama

```ts
const llm = useLlm("amazon:meta.chat.v1", {
    model: "llama3-8b-instruct-v1:0", // This is the model id from Bedrock
});
```

## LLama-Specific Options

In addition to the generic options, the following options are available for Meta LLama models on Bedrock.

| Option      | Type   | Default   | Description                                                              |
| ----------- | ------ | --------- | ------------------------------------------------------------------------ |
| model       | string | —         | The Bedrock model id. Must be specified. See AWS Bedrock Docs            |
| temperature | number | undefined | Maps to temperature.                                                     |
| maxTokens   | number | 2048      | Maps to max_gen_len. See AWS Bedrock Docs                                |
| topP        | number | undefined | Maps to top_p. See AWS Bedrock Docs                                      |
| awsRegion   | string | undefined | AWS Region. Can be set via `AWS_REGION` environment variable             |
| awsSecretKey| string | undefined | AWS Secret Key. Can be set via `AWS_SECRET_ACCESS_KEY` environment variable |
| awsAccessKey| string | undefined | AWS Access Key. Can be set via `AWS_ACCESS_KEY_ID` environment variable  |

> **Model identifiers:** `model` accepts a foundation model id, a cross-region inference profile id, or a full ARN. llm-exe URL-encodes it into the invoke path, so identifiers containing `/` or `:` route correctly:
>
> ```ts
> // 1. Foundation model id
> useLlm("amazon:meta.chat.v1", { model: "meta.llama3-8b-instruct-v1:0" });
>
> // 2. Cross-region inference profile id
> useLlm("amazon:meta.chat.v1", { model: "us.meta.llama3-8b-instruct-v1:0" });
>
> // 3. Full ARN
> useLlm("amazon:meta.chat.v1", {
>   model: "arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.meta.llama3-8b-instruct-v1:0",
> });
> ```
>
> Unlike the [Anthropic on Bedrock](/llm/bedrock/anthropic) config, no Meta option is gated on the model name, so every identifier form behaves identically here — there is no equivalent of the silent `effort` drop.