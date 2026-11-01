---
title: "Use Cohere Embeddings via AWS Bedrock | llm-exe"
description: "Generate Cohere Embed v3 and v4 embeddings via AWS Bedrock in TypeScript with llm-exe. Covers input types, batching, and variable output dimensions."
---

# Cohere Embeddings (via AWS Bedrock)

When using Cohere embeddings, llm-exe will make POST requests to the AWS Bedrock endpoint for your configured region. Both Cohere Embed v3 and Embed v4 are supported through a single provider key — pick the variant via the `model` option.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | — | The Bedrock model ID (e.g., `cohere.embed-english-v3`, `cohere.embed-multilingual-v3`, `cohere.embed-v4:0`) |
| `inputType` | `"search_document" \| "search_query" \| "classification" \| "clustering"` | `"search_document"` | How Cohere should prepare the embedding. Use `search_document` for the corpus you index and `search_query` for queries you embed at search time |
| `truncate` | `"NONE" \| "START" \| "END" \| "LEFT" \| "RIGHT"` | — | How over-length inputs are handled. `START`/`END` for v3, `LEFT`/`RIGHT` for v4. `NONE` returns an error if the input is too long |
| `dimensions` | `number` | — | Output vector size. For Embed v4: `256`, `512`, `1024`, or `1536` (maps to Cohere's `output_dimension`). For Embed v3: the model has a fixed 1024-dim output — passing `1024` is accepted as a no-op, any other value throws immediately so you don't silently get a different dimension than you asked for |
| `awsRegion` | `string` | `AWS_REGION` env var | The AWS region for the Bedrock endpoint (required) |
| `awsSecretKey` | `string` | — | AWS secret key (if not using default credentials) |
| `awsAccessKey` | `string` | — | AWS access key (if not using default credentials) |

## Basic Usage

```ts
import { createEmbedding } from "llm-exe";

const embeddings = createEmbedding("amazon:cohere.embedding.v1", {
  model: "cohere.embed-multilingual-v3",
  awsRegion: "us-west-2",
});

const embedding = await embeddings.call("The string of text you would like as vector");
const vector = embedding.getEmbedding();
console.log(vector);
// [
//   -0.0419921875, 0.005367279052734375, 0.011688232421875,
//   -0.0096893310546875, 0.039459228515625, -0.0231781005859375,
//   // ...
// ]
```

## Batching

Cohere accepts up to 96 texts per call. Pass an array to embed them in a single request:

```ts
const embedding = await embeddings.call([
  "RAG system design patterns",
  "Actuarial loss triangles and reserving primer",
]);

// One vector per input text
const first = embedding.getEmbedding(0);
const second = embedding.getEmbedding(1);
```

## Search vs Indexing

For retrieval (RAG) workflows, embed your corpus with `inputType: "search_document"` and your queries with `inputType: "search_query"`. Cohere prepends different special tokens for each case, which improves retrieval quality.

```ts
// At index time
const docEmbeds = createEmbedding("amazon:cohere.embedding.v1", {
  model: "cohere.embed-english-v3",
  inputType: "search_document",
});

// At query time
const queryEmbeds = createEmbedding("amazon:cohere.embedding.v1", {
  model: "cohere.embed-english-v3",
  inputType: "search_query",
});
```

## Embed v4 Output Dimensions

Cohere Embed v4 supports variable output dimensions. Pass `dimensions` to pick one of `256`, `512`, `1024`, or `1536` (default `1536` if unset). Smaller vectors trade off some retrieval quality for cheaper storage and faster nearest-neighbor lookups.

```ts
const embeddings = createEmbedding("amazon:cohere.embedding.v1", {
  model: "cohere.embed-v4:0",
  dimensions: 512,
});
```

## Multimodal Input (Embed v4)

Cohere Embed v4 can embed text and images together. Pass an array of `EmbeddingContentItem` objects instead of strings, and llm-exe routes them to Cohere's `inputs` field for you:

```ts
import { createEmbedding } from "llm-exe";
import type { EmbeddingContentItem } from "llm-exe";

const embeddings = createEmbedding("amazon:cohere.embedding.v1", {
  model: "cohere.embed-v4:0",
  awsRegion: "us-west-2",
});

const items: EmbeddingContentItem[] = [
  {
    content: [
      { type: "text", text: "A diagram of the retrieval pipeline" },
      { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo..." } },
    ],
  },
];

const embedding = await embeddings.call(items);
const vector = embedding.getEmbedding(0);
```

Each `EmbeddingContentItem` collapses into **one** vector. That is the point: a caption and its image become a single searchable embedding, rather than two vectors you have to reconcile later.

Things to know:

- `image_url.url` must be a complete data URI (e.g. `data:image/png;base64,...`). Bedrock does **not** fetch remote `http(s)` URLs — read the bytes yourself and inline them.
- Use a multimodal model. Embed v3 has no image support, and Bedrock will reject the request.
- A batch must be uniform. Mixing strings and content items in one call throws `embedding.unsupported_input`, because Cohere's `texts` and `inputs` fields are mutually exclusive and silently splitting the batch would misalign every downstream index. Embed text and multimodal entries in separate calls.
- Only `amazon:cohere.embedding.v1` accepts multimodal input. Passing content items to `openai.embedding.v1` or `amazon.embedding.v1` throws `embedding.unsupported_input` up front instead of producing an opaque provider-side 400.

## Notes

- Cohere on Bedrock does not include token usage in the response body. llm-exe reads it from Bedrock's `x-amzn-bedrock-input-token-count` / `x-amzn-bedrock-output-token-count` response headers, so `getResult().usage.input_tokens` is populated when those headers are present and falls back to `0` only when they are absent.
- Cohere models on Bedrock are served from AWS Marketplace. The first invocation in your account must come from a user with `aws-marketplace:Subscribe` permissions, after which all users in the account can invoke the model.
- `CohereBedrockEmbeddingOptions` also exposes an `imageInputs` option that writes Cohere's `inputs` field directly. It is an escape hatch — prefer passing content items as the call input, which takes precedence over the option.
