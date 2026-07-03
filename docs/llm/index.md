---
title: LLMs | Connect and Configure Models in llm-exe
description: "Use the same useLlm provider keys in prompt files or TypeScript. llm-exe supports OpenAI, Anthropic, Amazon, Google, xAI, Ollama, Deepseek, and custom providers."
---

# LLM

An LLM is the model/provider part of an llm-exe run.

In a prompt file, this is the `provider` field:

```yaml
provider: openai.gpt-4o-mini
message: "Answer briefly: {{question}}"
data:
  question: What is llm-exe?
```

Run it:

```bash
llm-exe ./answer.yml
```

`provider` is the same value you pass to [`useLlm`](#typescript). It can be a model shorthand or a generic provider key.

## Provider and Model

Use a model shorthand when llm-exe has one:

```yaml
provider: openai.gpt-4o-mini
message: "Summarize: {{text}}"
```

Or use a generic provider key with a model:

```yaml
provider: openai.chat.v1
model: gpt-4o-mini
message: "Summarize: {{text}}"
```

Use the generic form when you want the model to be easy to override:

```bash
llm-exe ./summarize.yml --model gpt-4.1
```

## LLM Options

Provider options go under `llmOptions`.

```yaml
provider: openai.chat.v1
model: gpt-4o-mini
message: "Answer briefly: {{question}}"
llmOptions:
  temperature: 0
  maxTokens: 200
```

All providers accept the [generic options](/llm/generic.html), such as timeout, retries, temperature, and max tokens. Each provider may also have provider-specific options.

## TypeScript

In TypeScript, use `useLlm`.

```ts
import { useLlm } from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
```

Generic provider key with model:

```ts
const llm = useLlm("openai.chat.v1", {
  model: "gpt-4o-mini",
  temperature: 0,
});
```

You usually pass the LLM to an [executor](/executor/index.html), but you can also call it directly.

```ts
const response = await llm.call(prompt);
console.log(response.getResultText());
```

## Authentication

Each provider requires its own account and API key.

You can provide credentials through:

1. Environment variables, such as `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
2. Setup options when creating the LLM
3. Execute options when running an executor

The CLI uses the same environment variables as the TypeScript API.

## Deprecation Warnings

Deprecated provider/model shorthands continue to resolve for compatibility, but emit a Node `DeprecationWarning` with code `LLM_EXE_DEPRECATED` on first use.

See [Deprecation Warnings](/llm/deprecations.html).

## Currently Supported Providers

llm-exe supports:

- [OpenAI](/llm/openai.html)
- [Anthropic](/llm/anthropic.html)
- [xAI](/llm/xai.html)
- [Google](/llm/gemini.html)
- [AWS Bedrock](/llm/bedrock/index.html)
- [Ollama](/llm/ollama.html)
- [Deepseek](/llm/deepseek.html)
- [Custom Providers](/llm/custom.html)

## Custom Providers

Custom provider configuration is TypeScript-only.

Use `useLlmConfiguration` when you need to:

- connect to an OpenAI-compatible API
- use a local model
- work with a corporate proxy
- add support for a new provider

See [Custom Provider Configuration](/llm/custom.html).
