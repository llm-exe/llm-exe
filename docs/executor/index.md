---
title: "LLM Executor | Structure Your LLM Calls with Type Safety | llm-exe"
description: The core building block of llm-exe. Create modular, testable LLM functions with typed inputs, custom prompts, and reliable output parsers. Build AI features that are easy to reason about and reuse.
---

# LLM Executor

The LLM executor takes an [llm](/llm/index.html), a [prompt](/prompt/index.html), optionally a [parser](/parser/index.html), and wraps in a well-typed executor function. An LLM executor is a _container_ that can be used to call an LLM with a pre-defined input and output; with additional values provided at the time of execution. The executor is responsible for combining and calling the provided components, with added tracing, metadata, and extendable hooks.

An LLM executor's input and output types are determined by the prompt and parser respectively. These are inferred automatically when working with Typescript. See working with types in prompts and parsers.

## Llm Executor Input

**llm** (required) `instance of BaseLlm`. Use `useLlm()` to create one.

**prompt** (required) `instance of BasePrompt` Either text or chat, respective of the LLM.

**parser** (optional) defaults to string if not provided.

**hooks** (optional) allows you to hook into various stages of the execution. Most useful for logging, but may be used for additional plugins.

## Basic Example

```typescript
import { useLlm, createChatPrompt, createLlmExecutor } from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
const instruction = `You are a customer support agent. Reply to the user's message.\n{{input}}`;
const prompt = createChatPrompt<{ input: string }>(instruction);

const executor = createLlmExecutor({
  llm,
  prompt,
});

const response = await executor.execute({ input: "Hello!" });
```

## Basic Example with All Options

```typescript
import { useLlm, createChatPrompt, createParser, createLlmExecutor } from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
const instruction = `You are a customer support agent. Reply to the user's message as JSON.\n{{input}}`;
const prompt = createChatPrompt<{ input: string }>(instruction);
const parser = createParser("json");

const hooks = {
  onComplete() {},
  onSuccess() {},
  onError() {},
};

const executor = createLlmExecutor(
  {
    llm,
    prompt,
    parser,
  },
  { hooks }
);

executor.on("onComplete", () => {});
executor.once("onComplete", () => {});

const response = await executor.execute({ input: "Hello!" });
```

`createLlmExecutor` Returns an instance of LlmExecutor.

## Function Executor

If you need tool/function calling support, use `createLlmFunctionExecutor`. It extends the standard LLM executor with the ability to define functions the LLM can call. This works with any provider that supports tool calling (OpenAI, Anthropic, Google, etc.).

```typescript
import { useLlm, createChatPrompt, createLlmFunctionExecutor } from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
const prompt = createChatPrompt("You are a helpful assistant.");

const executor = createLlmFunctionExecutor({
  llm,
  prompt,
});

const response = await executor.execute(
  { input: "What's the weather?" },
  {
    functionCall: "auto",
    functions: [
      {
        name: "get_weather",
        description: "Get the current weather",
        parameters: { /* JSON Schema */ },
      },
    ],
  }
);
```

`createLlmFunctionExecutor` Returns an instance of LlmExecutorWithFunctions.

See [Tool Calling Executor](/executor/openai-functions.html) for full documentation and examples.

## Core Executor

If you need a typed executor that wraps a plain function (no LLM involved), use `createCoreExecutor`. This is useful for composing non-LLM steps alongside LLM executors in a pipeline — the core executor provides the same `execute` interface, tracing, and hooks as an LLM executor.

```typescript
import { createCoreExecutor } from "llm-exe";

const executor = createCoreExecutor(
  async (input: { text: string }) => {
    return { wordCount: input.text.split(" ").length };
  }
);

const result = await executor.execute({ text: "Hello world from llm-exe" });
// result: { wordCount: 4 }
```

`createCoreExecutor` Returns an instance of CoreExecutor.
