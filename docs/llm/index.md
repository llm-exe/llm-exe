---
title: LLMs | Connect and Configure Models in llm-exe
description: "Use any LLM with a consistent, composable API. llm-exe supports OpenAI, Anthropic, Amazon, and more—giving you full control over model config, retries, and usage patterns with minimal setup."
---

# LLM

LLM is a wrapper around various LLM providers, making your function implementations LLM-agnostic.

Note: llm-exe utilizes the underlying API's from the various providers. This means that you must have an account (and usually an API key) with them if you want to call those models using llm-exe.

**LLM Features:**

- Built-in timeout mechanism for better control when a provider takes too long.
- Automatic retry with configurable back-off for errors.
- Use different LLM's with different configurations for different functions.
Note: You can use and call methods on LLM's directly, but they are usually passed to an LLM executor and then called internally.

## Using `useLlm`

The `useLlm` function creates an LLM instance. It takes a provider key and an optional options object.

### Provider Shorthand (by model)

Use a provider-specific model shorthand to get full type support for that model's options:

```ts
import { useLlm } from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
```

### Provider Key + Model Option

Use a generic provider key and specify the model in the options. This lets you use any model the provider supports without needing a dedicated shorthand:

```ts
const llm = useLlm("openai.chat.v1", {
  model: "gpt-4o",
});
```

### Options

All providers accept the [generic options](/llm/generic) (timeout, retries, temperature, maxTokens, etc.). Each provider may also accept provider-specific options — see the individual provider pages below.

### Deprecation Warnings

Deprecated provider/model shorthands continue to resolve for compatibility, but emit a Node `DeprecationWarning` with code `LLM_EXE_DEPRECATED` on first use. See [Deprecation Warnings](/llm/deprecations).

### Authentication

Each provider requires an API key. You can provide it in three ways:

1. **Environment variable** — set the provider's default env var (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
2. **Setup options** — pass the key when creating the LLM (e.g., `{ openAiApiKey: "sk-..." }`)
3. **Execute options** — pass the key at execution time

See the individual provider pages for the exact option names and env var names.

### Direct Usage

While you'll typically pass the LLM instance to an [executor](/executor/), you can also call it directly:

```ts
const llm = useLlm("openai.gpt-4o-mini");
const response = await llm.call(prompt);
console.log(response.getResultText());
```

## Currently Supported Providers

Currently, llm-exe supports calling LLM's from:

- [OpenAi](/llm/openai)
- [Anthropic](/llm/anthropic)
- [xAI](/llm/xai)
- [Google](/llm/gemini)
- [AWS Bedrock](/llm/bedrock/)
- [Ollama](/llm/ollama)
- [Deepseek](/llm/deepseek)
- [Custom Providers](/llm/custom)

## Adding Custom LLM's

You can create custom LLM configurations using `useLlmConfiguration`. This allows you to:

- Connect to OpenAI-compatible APIs
- Use local models
- Work with corporate proxies
- Add support for new providers

See the [Custom Provider Configuration](/llm/custom) guide for details.

## Token usage and prompt caching

Read normalized usage from `response.getResult().usage` after `llm.call()`. In an
executor hook, use `execution.handlerOutput?.getResult().usage`:

```ts
executor.on("onSuccess", (execution) => {
  const usage = execution.handlerOutput?.getResult().usage;
  if (!usage) return;
  console.log({
    input: usage.input_tokens,
    output: usage.output_tokens,
    total: usage.total_tokens,
    cacheRead: usage.cache_read_input_tokens,
    cacheWrite: usage.cache_creation_input_tokens,
  });
});
```

`input_tokens` includes cached input. The optional cache counts are a breakdown
of that input, so **do not add them to `input_tokens` or `total_tokens` again**.
An absent cache field means the provider did not report that count; an explicit
zero means it reported no tokens in that category. These counts describe tokens,
not prices, and reporting them does not enable caching.

| Provider | Cache reads | Cache writes | Input accounting |
| --- | --- | --- | --- |
| Anthropic, including Anthropic-format Bedrock responses | `usage.cache_read_input_tokens` | `usage.cache_creation_input_tokens` | Add reads and writes to the provider's uncached `input_tokens`. |
| OpenAI and compatible Chat Completions | `usage.prompt_tokens_details.cached_tokens` | `usage.prompt_tokens_details.cache_write_tokens`, when reported | Preserve the provider totals, which already include cached input. |
| xAI | `usage.prompt_tokens_details.cached_tokens` | Only when reported in the compatible response | Preserve provider totals. |
| DeepSeek | `usage.prompt_cache_hit_tokens`, falling back to `usage.prompt_tokens_details.cached_tokens` | Not inferred from cache misses | Preserve provider totals. |
| Gemini | `usageMetadata.cachedContentTokenCount` | Not reported by this adapter | Preserve provider totals. |

Anthropic's optional `usage.cache_creation` also preserves
`ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`. These subdivide cache
writes and must not be counted again. Bedrock header-only usage keeps the existing
fallback totals without inventing cache counts. Other adapters leave cache fields
absent when they do not report them.

For cached Anthropic requests, this corrects earlier llm-exe releases that
reported only uncached input and consequently understated total tokens. OpenAI,
xAI, DeepSeek, and Gemini totals are unchanged. Provider totals can include other
categories (for example, Gemini thoughts); the adapter preserves those totals.

Provider references:
[Anthropic accounting](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#tracking-cache-performance),
[OpenAI usage fields](https://developers.openai.com/api/reference/resources/completions),
[xAI cache usage](https://docs.x.ai/developers/advanced-api-usage/prompt-caching/usage-and-pricing),
[DeepSeek usage fields](https://api-docs.deepseek.com/api/create-chat-completion/),
and [Gemini UsageMetadata](https://ai.google.dev/api/generate-content#UsageMetadata).
