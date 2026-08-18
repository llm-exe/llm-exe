---
title: "Use Anthropic Claude in TypeScript with llm-exe"
description: "Connect Anthropic Claude models like claude-sonnet-5 to your TypeScript app with llm-exe. Covers setup, API key authentication, and Claude-specific options."
---

# Anthropic

When using Anthropic models, llm-exe will make POST requests to `https://api.anthropic.com/v1/messages`.

## Setup

### Anthropic Chat

```ts
const llm = useLlm("anthropic.chat.v1", {
  model: "claude-sonnet-5", // specify a model
});
```

### Anthropic Chat By Model

```ts
const llm = useLlm("anthropic.claude-sonnet-5", {
  // other options,
  // no model needed, using claude-sonnet-5
});
```

<ImportModelNames provider="anthropic" />


## Authentication

To authenticate, you need to provide an Anthropic API Key. You can either provide the API key various ways, depending on your use case.

- Pass in as execute options using `anthropicApiKey`
- Pass in as setup options using `anthropicApiKey`
- Use a default key by setting an environment variable of `ANTHROPIC_API_KEY`

## Basic Usage

Generally you pass the LLM instance off to an LLM Executor and call that. However, it is possible to interact with the LLM object directly, if you wanted.

```ts
// given array of chat messages, calls chat completion
await llm.call([]);

// given string prompt, calls completion
await llm.call("");
```

## Anthropic-Specific Options

<!--@include: ./anthropic.options.part.md-->