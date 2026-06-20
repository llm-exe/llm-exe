---
title: Prompts | Dynamic Prompt Templates in llm-exe
description: "Write prompt templates in prompt files or TypeScript. Use Handlebars variables, system messages, Markdown prompt bodies, and typed prompt inputs."
---

# Prompt

The prompt is the instruction sent to the LLM.

In a prompt file, the main fields are `system`, `message`, and `data`.

```yaml
provider: openai.gpt-4o-mini
system: You are a helpful summarizer.
message: "Summarize: {{text}}"
data:
  text: Long article...
```

Run it:

```bash
llm-exe ./summarize.yml
```

`message` is a Handlebars template. Values come from `data` or from the input you pass at runtime.

```bash
llm-exe ./summarize.yml --data.text "Different article..."
```

## Markdown Prompts

Markdown prompt files put the config in frontmatter and the prompt in the body.

```markdown
---
provider: openai.gpt-4o-mini
system: You are a helpful summarizer.
data:
  text: Long article...
---

Summarize this:

{{text}}
```

This is often easier for long prompts than writing a large quoted YAML string.

See [Prompt File Formats](/config/formats.html).

## Template Variables

Prompt files use the same Handlebars syntax as TypeScript prompts.

```yaml
provider: openai.gpt-4o-mini
message: "Write a {{tone}} email to {{name}}."
data:
  tone: friendly
  name: Greg
```

Override values from the CLI:

```bash
llm-exe ./email.yml --data.tone formal --data.name Sam
```

Or pass input from TypeScript:

```ts
const executor = executorFromConfig(config);
const result = await executor.execute({
  tone: "formal",
  name: "Sam",
});
```

## TypeScript

In TypeScript, create prompts with `createChatPrompt` or `createPrompt`.

```ts
import { createChatPrompt } from "llm-exe";

const prompt = createChatPrompt<{ text: string }>(
  "Summarize this:\n\n{{text}}",
);

const output = prompt.format({
  text: "Long article...",
});
```

Prompt input types are inferred when you provide them.

```ts
const prompt = createChatPrompt<{ tone: string; name: string }>(
  "Write a {{tone}} email to {{name}}.",
);
```

## Chat and Text Prompts

llm-exe includes:

- [Text Prompt](/prompt/text.html)
- [Chat Prompt](/prompt/chat.html)
- [Prompt Validation](/prompt/validation.html)

Prompt files use a chat-style prompt under the hood: `system` becomes the system message, and `message` becomes the user message.

## Helpers and Partials

Handlebars helpers and partials are JavaScript functions, so they do not live in prompt files.

Use TypeScript when you need custom helpers, partials, or more control over prompt construction.

See [Advanced Prompt Usage](/prompt/advanced.html).
