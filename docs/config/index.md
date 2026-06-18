---
title: "Config | Build Executors from Files"
description: "Load an llm-exe executor from JSON, YAML, Markdown, a URL, or a file."
---

# Config

The config helpers let you describe an executor with data instead of code.

This is useful when you want a prompt to live in a file, a database, a CMS, or a GitHub Action input, but still run through the same llm-exe pieces: `useLlm`, `createChatPrompt`, `createParser`, and `createLlmExecutor`.

```ts
import { executorFromConfig, loadExecutorConfig } from "llm-exe";

const config = loadExecutorConfig({
  provider: "openai.gpt-4o-mini",
  system: "You are a helpful summarizer.",
  message: "Summarize: {{text}}",
  parser: "string",
});

const executor = executorFromConfig(config);
const response = await executor.execute({ text: "Long article..." });
```

`executorFromConfig` returns a normal llm-exe executor. There is no special config executor class.

You can try the config helpers without an API key by using the mock provider.

```ts
import { loadExecutorConfig, runConfig } from "llm-exe";

const response = await runConfig(
  loadExecutorConfig({
    provider: "openai.chat-mock.v1",
    message: "Hello {{name}}",
    data: {
      name: "Greg",
    },
  }),
);
```

## Config Shape

A config is a plain object with the same parts you would normally create in code.

```ts
{
  provider: "openai.gpt-4o-mini",
  system: "You are a helpful assistant.",
  message: "Answer this: {{question}}",
  parser: "string",
  data: {
    question: "What is llm-exe?"
  }
}
```

`provider` and `message` are required.

`provider` must be a real [`useLlm`](/llm/index.html) key, like `openai.gpt-4o-mini`, `openai.chat.v1`, or `anthropic.claude-sonnet-4-6`. It is not just the vendor name.

`parser` defaults to `string` if you leave it out.

See [Config File Formats](/config/formats.html) for the full field list and the JSON/YAML/Markdown examples.

## Loading Configs

There are a few ways to get to the same normalized config.

```ts
import {
  loadExecutorConfig,
  parseExecutorConfig,
  loadConfigFromUrl,
} from "llm-exe";

const fromObject = loadExecutorConfig({
  provider: "openai.gpt-4o-mini",
  message: "Hello {{name}}",
});

const fromString = await parseExecutorConfig(yamlString, {
  format: "yaml",
});

const fromUrl = await loadConfigFromUrl("https://example.com/prompt.yml");
```

File loading is Node-only, so it is exported from `llm-exe/node`.

```ts
import { loadConfigFromFile } from "llm-exe/node";

const config = await loadConfigFromFile("./summarize.yml");
```

## Running Once

If you only want to run the config once, use `runConfig`.

```ts
import { loadExecutorConfig, runConfig } from "llm-exe";

const config = loadExecutorConfig({
  provider: "openai.gpt-4o-mini",
  message: "Summarize: {{text}}",
  data: {
    text: "Default text",
  },
});

const response = await runConfig(config);
```

You can override `data` for that run. The override is merged over the config's `data`.

```ts
const response = await runConfig(config, {
  data: {
    text: "Different text",
  },
});
```

For files, use `runFile`.

```ts
import { runFile } from "llm-exe/node";

const response = await runFile("./summarize.yml", undefined, {
  data: { text: "Different text" },
});
```

## Reusing an Executor

If you are going to call the executor many times, build the executor once and pass input each time.

```ts
const executor = executorFromConfig(config);

for (const article of articles) {
  const summary = await executor.execute({ text: article.body });
}
```

This behaves like any other executor created with `createLlmExecutor`.

`config.data` is not automatically passed on every call. It is used by the one-shot helpers (`runConfig` and `runFile`). When you use the executor directly, pass the input yourself.

## Patches

Loaders accept a second argument for values you want to override.

```ts
const config = loadExecutorConfig(fileObject, {
  model: "gpt-4.1",
  data: {
    locale: "en-US",
  },
});
```

Patch precedence is caller over file. `data` is deep-merged. Other fields replace the value from the file.

## Function Calling

Function schemas can live in a config because they are just data.

```yaml
provider: openai.gpt-4o-mini
message: What is the weather in {{city}}?
data:
  city: Denver
executorOptions:
  functionCall: auto
  functions:
    - name: get_weather
      description: Get the current weather for a city.
      parameters:
        type: object
        properties:
          city:
            type: string
        required: [city]
```

When `executorOptions.functions` is present, llm-exe creates a function-calling executor.

`executorOptions` are passed at execute time. `runConfig` and `runFile` do this for you.

```ts
const result = await runFile("./weather.yml");
```

If you use the executor directly, pass the options yourself.

```ts
const executor = executorFromConfig(config);
const result = await executor.execute(
  { city: "Denver" },
  config.executorOptions,
);
```

::: warning
A config can define the function schema, but it cannot define the function handler. The handler is JavaScript code. If you need to call a tool and feed the result back to the model, that is an agent loop built around the executor.
:::

## Hooks

Hooks are construction options, just like with `createLlmExecutor`.

```ts
const executor = executorFromConfig(config, {
  hooks: {
    onComplete(metadata) {
      console.log(metadata);
    },
  },
});
```

`executorOptions` are different. Those are passed to `.execute()`.

## Browser and Node

The package root is browser-safe.

```ts
import { executorFromConfig, runConfig } from "llm-exe";
```

File loading uses `node:fs`, so it lives under `llm-exe/node`.

```ts
import { loadConfigFromFile, runFile } from "llm-exe/node";
```

URL loading uses `fetch`. You can pass your own `fetch` implementation if you need to test it or control request behavior.

```ts
const config = await loadConfigFromUrl("https://example.com/prompt.yml", {
  fetch: myFetch,
});
```

## Errors

Config parsing and validation errors use normal llm-exe errors.

Common codes:

- `configuration.parse_failed`
- `configuration.invalid_config`
- `configuration.file_not_found`
- `configuration.file_read_failed`
- `configuration.unsupported_format`
