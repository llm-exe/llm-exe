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

All providers accept the [generic options](/llm/generic.html) (timeout, retries, temperature, maxTokens, etc.). Each provider may also accept provider-specific options — see the individual provider pages below.

### Deprecation Warnings

Deprecated provider/model shorthands continue to resolve for compatibility, but emit a Node `DeprecationWarning` with code `LLM_EXE_DEPRECATED` on first use. See [Deprecation Warnings](/llm/deprecations.html).

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

- [OpenAi](/llm/openai.html)
- [Anthropic](/llm/anthropic.html)
- [xAI](/llm/xai.html)
- [Google](/llm/gemini.html)
- [AWS Bedrock](/llm/bedrock/index.html)
- [Ollama](/llm/ollama.html)
- [Deepseek](/llm/deepseek.html)
- [Custom Providers](/llm/custom.html)

## Adding Custom LLM's

You can create custom LLM configurations using `useLlmConfiguration`. This allows you to:

- Connect to OpenAI-compatible APIs
- Use local models
- Work with corporate proxies
- Add support for new providers

See the [Custom Provider Configuration](/llm/custom.html) guide for details.
