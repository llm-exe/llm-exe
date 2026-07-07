---
title: "Run Local LLMs with Ollama in TypeScript | llm-exe"
description: "Run local models like deepseek-r1 through Ollama in TypeScript with llm-exe. Covers endpoint configuration, model selection, and direct LLM calls."
---

# Ollama

When using Ollama models, llm-exe will make POST requests to `http://localhost:11434`. You can also override this by setting the environment variable `OLLAMA_ENDPOINT`. All models are supported if you pass `ollama.chat.v1` as the first argument, and then specify a model in the options (assuming you have downloaded this model).

## Basic Usage

### Ollama Chat

```ts
const llm = useLlm("ollama.chat.v1", {
  model: "deepseek-r1", // specify a model
});
```

### Ollama Chat By Model

```ts
const llm = useLlm("ollama.deepseek-r1", {
  // other options,
  // no model needed, using deepseek-r1
});
```

<ImportModelNames provider="ollama" />

## Configuration

By default, llm-exe connects to `http://localhost:11434`. To use a different Ollama endpoint, set the `OLLAMA_ENDPOINT` environment variable.

Generally you pass the LLM instance off to an LLM Executor and call that. However, it is possible to interact with the LLM object directly, if you wanted.

```ts
// call the LLM directly with a prompt
await llm.call(prompt);
```

## Ollama-Specific Options

| Option | Type   | Default   | Description                                                    |
| ------ | ------ | --------- | -------------------------------------------------------------- |
| model  | string | —         | The model to use. Must be specified when using `ollama.chat.v1`. |

> [!NOTE]
> The Ollama provider currently maps `model` and `prompt` only. Generic options like `temperature`, `maxTokens`, and `topP` are not mapped to the Ollama API at this time. The Ollama request body is sent directly to the `/api/chat` endpoint.

See [Ollama Docs](https://ollama.com/) for details.
