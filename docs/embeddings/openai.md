---
title: "Use OpenAI Embeddings in TypeScript | llm-exe"
description: "Create OpenAI embeddings like text-embedding-3-small in TypeScript with llm-exe, or point baseUrl at any OpenAI-compatible endpoint such as vLLM or Together AI."
---

# OpenAI Embeddings

When using OpenAI embeddings, llm-exe will make POST requests to `https://api.openai.com/v1/embeddings` by default. Override `baseUrl` to point at any OpenAI-compatible embeddings endpoint (Baseten, Together, vLLM, TEI, etc.) — see [OpenAI-Compatible Endpoints](#openai-compatible-endpoints) below.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | — | The OpenAI embedding model to use (e.g., `text-embedding-3-small`) |
| `dimensions` | `number` | `1536` | The number of dimensions for the output embedding |
| `encodingFormat` | `string` | — | The encoding format (e.g., `float`, `base64`) |
| `openAiApiKey` | `string` | `OPENAI_API_KEY` env var | Your OpenAI (or compatible provider) API key. Sent as `Authorization: Bearer <key>` |
| `baseUrl` | `string` | `https://api.openai.com/v1` | Base URL for the embeddings request. The final endpoint is `{baseUrl}/embeddings` |

## Basic Usage

```ts
import { createEmbedding } from "llm-exe";

const embeddings = createEmbedding("openai.embedding.v1", {
    model: "text-embedding-3-small",
});

const str = "The string of text you would like as vector";
const embedding = await embeddings.call(str);
const vector = embedding.getEmbedding();
console.log(vector);
// [
//   -0.014564549,   0.026690058,  -0.021338109,  -0.042174473,   -0.05775645,
//    -0.04404208, -0.0035819034,  -0.012320633,   -0.02112905,   0.030355586,
// ...etc
// ]
```

## Custom Dimensions

```ts
const embeddings = createEmbedding("openai.embedding.v1", {
    model: "text-embedding-3-small",
    dimensions: 512,
});
```

## OpenAI-Compatible Endpoints

The `openai.embedding.v1` provider can talk to any service that implements the OpenAI `/embeddings` API shape. Pass `baseUrl` to redirect the request, and pass your provider's API key via `openAiApiKey` (it is sent as a bearer token regardless of which provider it belongs to).

### Baseten

```ts
const embeddings = createEmbedding("openai.embedding.v1", {
  baseUrl: "https://model-xyz.api.baseten.co/environments/production/sync/v1",
  openAiApiKey: process.env.BASETEN_API_KEY,
  model: "Qwen/Qwen3-Embedding-8B",
});
```

### Together AI

```ts
const embeddings = createEmbedding("openai.embedding.v1", {
  baseUrl: "https://api.together.xyz/v1",
  openAiApiKey: process.env.TOGETHER_API_KEY,
  model: "BAAI/bge-large-en-v1.5",
});
```

### Local servers (vLLM, TEI, Ollama, LM Studio)

For local OpenAI-compatible servers, point `baseUrl` at the server and pass a placeholder key if the server doesn't require auth:

```ts
const embeddings = createEmbedding("openai.embedding.v1", {
  baseUrl: "http://localhost:8000/v1",
  openAiApiKey: "not-needed",
  model: "BAAI/bge-base-en-v1.5",
});
```

Notes:

- `{baseUrl}` is concatenated with `/embeddings`, so omit any trailing `/embeddings` from the URL.
- If your compatible provider doesn't support `dimensions` or returns a fixed vector size, the default `dimensions: 1536` may need to be overridden or left to the provider — consult the provider's docs.
