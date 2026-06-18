---
title: "Prompt File Formats | JSON, YAML, and Markdown"
description: "Write llm-exe prompt files as JSON, YAML, or Markdown with frontmatter."
---

# Prompt File Formats

Prompt files can be written as JSON, YAML, or Markdown.

All three formats load into the same prompt file shape.

## Fields

**provider** (required)  
A [`useLlm`](/llm/index.html) provider key, like `openai.gpt-4o-mini` or `openai.chat.v1`.

**message** (required)  
The user message. This can be a Handlebars template. It must not be empty.

**system** (optional)  
The system message. This can also be a Handlebars template.

**model** (optional)  
Model override. This is merged into the options passed to `useLlm`.

**parser** (optional)  
The parser name. Defaults to `string`. See [Included Parsers](/parser/included-parsers.html).

**parserOptions** (optional)  
Options passed to the parser.

**llmOptions** (optional)  
Options passed to `useLlm`, such as temperature or max tokens.

**executorOptions** (optional)  
Options passed to `.execute()`. This is where function schemas, `functionCall`, and similar execute-time options go.

**data** (optional)  
Default template variables.

## JSON

```json
{
  "provider": "openai.gpt-4o-mini",
  "system": "You are a helpful summarizer.",
  "message": "Summarize: {{text}}",
  "parser": "string",
  "data": {
    "text": "hello world"
  }
}
```

## YAML

```yaml
provider: openai.gpt-4o-mini
system: You are a helpful summarizer.
message: "Summarize: {{text}}"
parser: string
data:
  text: hello world
```

## Markdown

Markdown uses YAML frontmatter for file fields. The body becomes `message`.

```markdown
---
provider: openai.gpt-4o-mini
system: You are a helpful summarizer.
parser: string
data:
  text: hello world
---

Summarize: {{text}}
```

This is useful for longer prompts because the prompt can be written as the document body instead of a quoted YAML string.

If the frontmatter has `message` and the body also has content, llm-exe throws `configuration.invalid_config`. There should only be one message. The body wins by being the message.

Markdown files can use `\n` or `\r\n` line endings.

## Parser Alias

`output` is accepted as an alias for `parser`.

```yaml
provider: openai.gpt-4o-mini
message: Return a JSON object for {{input}}
output: json
```

This exists for compatibility with router-style configs. Prefer `parser` in new files.

If both `parser` and `output` are present, `parser` is used.

## Format Detection

Files and URLs use the extension when possible.

| Extension          | Format   |
| ------------------ | -------- |
| `.json`            | JSON     |
| `.yml`, `.yaml`    | YAML     |
| `.md`, `.markdown` | Markdown |

For strings, pass the format.

```ts
import { parseExecutorConfig } from "llm-exe";

const config = await parseExecutorConfig(source, {
  format: "yaml",
});
```

`auto` is available when there is no extension or you do not know the format.

```ts
const config = await parseExecutorConfig(source, {
  format: "auto",
});
```

`auto` tries JSON, then Markdown when there is a frontmatter fence, then YAML. Use an explicit format when you can.

## With Parser Options

Parser options are plain data, so they can live in the prompt file.

```yaml
provider: openai.gpt-4o-mini
message: "Extract the sentiment from: {{text}}"
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

## With LLM Options

```yaml
provider: openai.chat.v1
model: gpt-4o-mini
message: "Answer briefly: {{question}}"
llmOptions:
  temperature: 0
data:
  question: What is llm-exe?
```

Use provider shorthands when you want:

```yaml
provider: openai.gpt-4o-mini
message: "Answer briefly: {{question}}"
```

Use a generic provider key plus `model` when you want the model to be set from the file or patched by the caller.
