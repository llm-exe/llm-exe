# Embeddings

Embeddings is a wrapper around various embeddings providers, making your function implementations vendor-agnostic.

**Embeddings Features:**

- Built-in timeout mechanism for better control when a provider takes too long.
- Automatic retry with configurable back-off for errors.
- Use different LLM's with different configurations for different functions.

## Basic Usage

Use `createEmbedding` to create an embedding instance for a supported provider, then call it with the text you want to embed:

```ts
import { createEmbedding } from "llm-exe";

const embeddings = createEmbedding("openai.embedding.v1", {
  model: "text-embedding-3-small",
});

const embedding = await embeddings.call("The text you want to embed");
const vector = embedding.getEmbedding();
// Returns a number[] representing the embedding vector
```

### Parameters

`createEmbedding(provider, options)` accepts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `provider` | `EmbeddingProviderKey` | The embedding provider key (see supported providers below) |
| `options` | `object` | Provider-specific options including `model` |

The returned object has a `.call(input)` method that returns a promise. The resolved result has a `.getEmbedding()` method that returns the embedding vector as `number[]`.

## Supported Embedding Providers

| Provider | Key | Details |
|----------|-----|---------|
| OpenAI (and OpenAI-compatible) | `openai.embedding.v1` | [OpenAI Embeddings](./openai.md) |
| Amazon Titan | `amazon.embedding.v1` | [Amazon Embeddings](./amazon.md) |
| Cohere (via Bedrock) | `amazon:cohere.embedding.v1` | [Cohere Embeddings](./cohere.md) |

The `openai.embedding.v1` provider accepts a `baseUrl` option, so it can also be used with any OpenAI-compatible embeddings endpoint (Baseten, Together AI, vLLM, TEI, local servers, etc.). See [OpenAI Embeddings → OpenAI-Compatible Endpoints](./openai.md#openai-compatible-endpoints).

## Adding Custom Providers
Custom embedding providers are not currently supported. If you need an embedding provider that isn't listed above, please open an issue.
