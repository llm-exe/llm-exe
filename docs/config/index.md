---
title: "Prompt Files | Run Prompts from Files"
description: "Write a prompt file once, run it from the CLI, and reuse it from TypeScript."
---

# Prompt Files

Prompt files let you keep a prompt, model, parser, and default input in one file.

```yaml
provider: openai.gpt-4o-mini
message: "Summarize: {{text}}"
parser: string
data:
  text: Long article...
```

Run it from the terminal:

```bash
llm-exe ./summarize.yml
```

Or load the same file from TypeScript:

```ts
import { runFile } from "llm-exe/node";

const summary = await runFile("./summarize.yml");
```

This is the same llm-exe pipeline you would build by hand: LLM, prompt, parser, executor. The file is just the parts that can be represented as data.

## Why Use Prompt Files

Prompt files are useful when the prompt is not really application logic.

Examples:

- prompts used in CI
- prompts you want to edit without touching TypeScript
- prompts shared between local scripts and app code
- long prompts that are easier to review as files
- prompts where parser/schema validation matters

The parser is the important part. A prompt file is not just "send this text to an LLM." It can still use llm-exe parsers.

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
data:
  text: I love this.
```

## Run a File

Use the CLI when you just want the result.

```bash
llm-exe ./summarize.yml --data.text "Different article..."
```

Use `runFile` when you want the same thing from Node.

```ts
import { runFile } from "llm-exe/node";

const result = await runFile("./summarize.yml", undefined, {
  data: {
    text: "Different article...",
  },
});
```

`data` is merged over the file's `data`.

## Reuse a File from TypeScript

If you want to call the executor more than once, load the file and build an executor.

```ts
import { executorFromConfig } from "llm-exe";
import { loadConfigFromFile } from "llm-exe/node";

const config = await loadConfigFromFile("./summarize.yml");
const executor = executorFromConfig(config);

for (const article of articles) {
  const summary = await executor.execute({ text: article.body });
}
```

`executorFromConfig` returns a normal llm-exe executor. It does not automatically pass `config.data` on every call. When you use the executor directly, pass the input yourself.

## Use an Object Instead

You do not have to start from a file. You can normalize an object with `loadExecutorConfig`.

```ts
import { executorFromConfig, loadExecutorConfig } from "llm-exe";

const config = loadExecutorConfig({
  provider: "openai.gpt-4o-mini",
  message: "Hello {{name}}",
  data: {
    name: "Greg",
  },
});

const result = await executorFromConfig(config).execute(config.data ?? {});
```

You can also parse a string or load from a URL.

```ts
import { loadConfigFromUrl, parseExecutorConfig } from "llm-exe";

const fromYaml = await parseExecutorConfig(yamlString, { format: "yaml" });
const fromUrl = await loadConfigFromUrl("https://example.com/prompt.yml");
```

Remote URLs are explicit in the CLI with `--remote`. From TypeScript, calling `loadConfigFromUrl` means you are choosing to fetch that URL.

## File Formats

Prompt files can be JSON, YAML, or Markdown.

Markdown is useful for longer prompts:

```markdown
---
provider: openai.gpt-4o-mini
parser: string
data:
  topic: rate limiting
---

Write a short explanation of {{topic}}.
```

See [Prompt File Formats](/config/formats.html) for the field list and format rules.

## What Can Go in a File

Anything that is data can go in a prompt file:

- `provider`
- `model`
- `system`
- `message`
- `parser`
- `parserOptions`
- `llmOptions`
- `executorOptions`
- `data`

Anything that is live JavaScript stays in code:

- hooks
- custom parser functions
- tool handlers
- custom provider registration
- Handlebars helpers and partials

Hooks can still be supplied when you build the executor.

```ts
const executor = executorFromConfig(config, {
  hooks: {
    onComplete(metadata) {
      console.log(metadata);
    },
  },
});
```

## Function Calling

Function schemas are data, so they can live in a prompt file.

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

The function handler is not data. llm-exe can ask the model which function it wants to call, but your code still runs the function.

## Try It with No Key

The mock provider lets you test the file flow without an API key.

```yaml
provider: openai.chat-mock.v1
message: "Hello {{name}}"
data:
  name: Greg
```

```bash
llm-exe ./hello.yml
```

## Errors

Prompt file parsing and validation errors use normal llm-exe errors.

Common codes:

- `configuration.parse_failed`
- `configuration.invalid_config`
- `configuration.file_not_found`
- `configuration.file_read_failed`
- `configuration.unsupported_format`
