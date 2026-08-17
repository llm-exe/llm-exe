---
title: "Use Amazon Titan Embeddings on AWS Bedrock | llm-exe"
description: "Generate Amazon Titan embeddings via AWS Bedrock in TypeScript with llm-exe. Covers model IDs, output dimensions, AWS regions, and credential setup."
---

# Amazon Embeddings

When using Amazon embeddings, llm-exe will make POST requests to the AWS Bedrock endpoint for your configured region.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | — | The Bedrock model ID (e.g., `amazon.titan-embed-text-v2:0`) |
| `dimensions` | `number` | `512` | The number of dimensions for the output embedding |
| `awsRegion` | `string` | `AWS_REGION` env var | The AWS region for the Bedrock endpoint (required) |
| `awsSecretKey` | `string` | — | AWS secret key (if not using default credentials) |
| `awsAccessKey` | `string` | — | AWS access key (if not using default credentials) |

## Basic Usage

```ts
import { createEmbedding } from "llm-exe";

const embeddings = createEmbedding("amazon.embedding.v1", {
  model: "amazon.titan-embed-text-v2:0",
});

const str = "The string of text you would like as vector";
const embedding = await embeddings.call(str);
const vector = embedding.getEmbedding();
console.log(vector);
// [
//  -0.08704914152622223,   0.062177956104278564,     0.0284775048494339,
//    0.0569550096988678,   0.021762285381555557,   0.046509113162755966,
// ...etc
// ]
```

## Notes

- This provider targets Titan's text embedding request shape, which takes a single `inputText` string. Passing multimodal content items throws `embedding.unsupported_input`; use [Cohere via Bedrock](./cohere.md#multimodal-input-embed-v4) to embed images.
