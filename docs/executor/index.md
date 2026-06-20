---
title: "LLM Executor | Run Prompts with Models and Parsers"
description: "Run a prompt file, or build the same executor in TypeScript with an LLM, prompt, and parser."
---

# LLM Executor

An executor combines the [LLM](/llm/index.html), [prompt](/prompt/index.html), and [parser](/parser/index.html), then runs them with input.

In a prompt file, those pieces are the file:

```yaml
provider: openai.gpt-4o-mini
system: You are a customer support agent.
message: "Reply to the user's message.\n\n{{input}}"
parser: string
```

Run it:

```bash
llm-exe ./support.yml --data.input "Hello!"
```

That is the file version of an LLM executor.

## Run Once

Use the CLI when you only need the result.

```bash
llm-exe ./support.yml --data.input "Hello!"
```

Use `runFile` from Node when you want the same one-shot behavior in code.

```ts
import { runFile } from "llm-exe/node";

const response = await runFile("./support.yml", undefined, {
  data: {
    input: "Hello!",
  },
});
```

## Reuse an Executor

If you want to run the same prompt many times, load the file and build an executor.

```ts
import { executorFromConfig } from "llm-exe";
import { loadConfigFromFile } from "llm-exe/node";

const config = await loadConfigFromFile("./support.yml");
const executor = executorFromConfig(config);

const response = await executor.execute({
  input: "Hello!",
});
```

`executorFromConfig` returns the normal llm-exe executor. It does not create a new executor type.

## TypeScript

The same executor can be built directly in TypeScript.

```ts
import { useLlm, createChatPrompt, createLlmExecutor } from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
const prompt = createChatPrompt<{ input: string }>(
  "You are a customer support agent. Reply to the user's message.\n\n{{input}}",
);

const executor = createLlmExecutor({
  llm,
  prompt,
});

const response = await executor.execute({ input: "Hello!" });
```

The prompt-file version is smaller when everything is data. The TypeScript version is better when you need custom code, helpers, custom parsers, or more control over composition.

## With a Parser

Prompt file:

```yaml
provider: openai.gpt-4o-mini
message: "Extract sentiment from: {{text}}"
parser: json
parserOptions:
  schema:
    type: object
    properties:
      sentiment:
        type: string
    required: [sentiment]
```

TypeScript:

```ts
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");
const prompt = createChatPrompt<{ text: string }>(
  "Extract sentiment from: {{text}}",
);
const parser = createParser("json", {
  schema: {
    type: "object",
    properties: {
      sentiment: { type: "string" },
    },
    required: ["sentiment"],
  },
});

const executor = createLlmExecutor({ llm, prompt, parser });
```

## Hooks

Hooks are TypeScript construction options.

```ts
const executor = executorFromConfig(config, {
  hooks: {
    onComplete(metadata) {
      console.log(metadata);
    },
  },
});
```

## Function Executor

Prompt files can include function schemas.

```yaml
provider: openai.gpt-4o-mini
message: What is the weather in {{city}}?
data:
  city: Denver
executorOptions:
  functionCall: auto
  functions:
    - name: get_weather
      description: Get the current weather
      parameters:
        type: object
        properties:
          city:
            type: string
        required: [city]
```

When `executorOptions.functions` is present, llm-exe creates a function-calling executor.

In TypeScript, use `createLlmFunctionExecutor`.

```ts
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
        parameters: { type: "object", properties: {} },
      },
    ],
  },
);
```

See [Tool Calling Executor](/executor/openai-functions.html).

## Core Executor

If you need an executor around a plain function, use `createCoreExecutor`.

```ts
import { createCoreExecutor } from "llm-exe";

const executor = createCoreExecutor(async (input: { text: string }) => {
  return { wordCount: input.text.split(" ").length };
});

const result = await executor.execute({
  text: "Hello world from llm-exe",
});
```

Core executors are TypeScript-only.
