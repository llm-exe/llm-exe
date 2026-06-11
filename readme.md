# llm-exe

[![tests](https://github.com/llm-exe/llm-exe/actions/workflows/tests.yml/badge.svg)](https://github.com/llm-exe/llm-exe/actions/workflows/tests.yml) [![Coverage Status](https://coveralls.io/repos/github/llm-exe/llm-exe/badge.svg?branch=main)](https://coveralls.io/github/llm-exe/llm-exe?branch=main) [![npm version](https://badge.fury.io/js/llm-exe.svg)](https://badge.fury.io/js/llm-exe)

A package that provides simplified base components to make building and maintaining LLM-powered applications easier.

- Write functions powered by LLM's with easy to use building blocks.
- Pure Javascript and Typescript. Allows you to pass and infer types.
- Supercharge your prompts by using handlebars within prompt template.
- Support for text-based and chat-based prompts. (ChatGPT, Claude, Grok, Gemini, Bedrock, Ollama, etc)
- Call LLM's from different providers without changing your code. (OpenAi/Anthropic/xAI/Google/AWS Bedrock/Ollama/Deepseek)
- Allow LLM's to call functions (or call other LLM executors).
- Not very opinionated. You have control on how you use it.

![llm-exe](https://assets.llm-exe.com/llm-exe-featured-2025.png)

See full docs here: [https://llm-exe.com](https://llm-exe.com)

---

# Install

Install llm-exe using npm.

```
npm i llm-exe
```

ESM-first. CommonJS works too.

```typescript
// ESM
import * as llmExe from "llm-exe";
// or specific modules
import { useLlm, createChatPrompt, createParser } from "llm-exe";

// CommonJS
const llmExe = require("llm-exe");
```

## Overview

```ts
import { useLlm, createChatPrompt, createParser, createLlmExecutor, defineSchema } from "llm-exe";

// Prompt
const prompt = createChatPrompt("You are a support agent. Help the user.");
prompt.addUserMessage("I need help with my order.");

// LLM
const llm = useLlm("openai.gpt-4o");

// Parser — schema uses JSON Schema (via defineSchema)
const schema = defineSchema({
  type: "object",
  properties: {
    answer: { type: "string" },
    action: { type: "string" },
  },
  required: ["answer", "action"],
} as const);
const parser = createParser("json", { schema });

// Executor
const executor = createLlmExecutor({ llm, prompt, parser });
await executor.execute({ input: "..." });
```

#### Prompt Helpers

```ts
const prompt = createChatPrompt(`
{{#if user.isFirstTime}}
Welcome!
{{else}}
Welcome back!
{{/if}}
`);
```

#### Built-In Parsers

```ts
createParser("string");              // pass-through, returns string
createParser("json", { schema });    // JSON with optional schema validation
createParser("boolean");             // extracts boolean from response
createParser("number");              // extracts number from response
createParser("stringExtract", { enum: ["yes", "no"] }); // match one of the enum values
createParser("listToArray");         // newline-separated list → string[]
createParser("listToJson");          // key: value list → object (with optional schema)
createParser("listToKeyValue");      // key: value list → Array<{ key, value }>
createParser("markdownCodeBlock");   // single code block → { code, language }
createParser("markdownCodeBlocks");  // multiple code blocks → Array<{ code, language }>
createParser("replaceStringTemplate"); // handlebars-based output templating
```

#### Custom Parsers

```ts
const parser = createCustomParser("MyUppercaseParser", (output, input) => {
  return output.toUpperCase();
});
```

#### State

Manage conversation history and structured data across LLM calls:

```ts
import { createState, createDialogue, createStateItem } from "llm-exe";

// Create a state container
const state = createState();

// Dialogues — store conversation history
const chat = state.createDialogue("chat");
chat.setUserMessage("Hi");
chat.setAssistantMessage("Hello!");
chat.getHistory(); // returns message array

// Standalone dialogue (without state)
const dialogue = createDialogue("chat");
dialogue.setUserMessage("Hi");

// Context items — typed values with get/set/reset
const intent = createStateItem("userIntent", "unknown");
state.createContextItem(intent);
intent.setValue("booking");
intent.getValue();    // "booking"
intent.resetValue();  // resets to "unknown"

// Attributes — simple key-value metadata
state.setAttribute("userId", "abc-123");
state.attributes["userId"]; // "abc-123"
```

#### Hooks

```ts
executor.on("onSuccess", console.log);
executor.on("onError", console.error);
```

## Basic Example

Below is simple example:

```typescript
// 1. Use the model you want
const llm = useLlm("openai.gpt-4o");

// 2. Create a parameterized prompt
const instruction = `
You are a classifier. Given a user message, reply with the category it belongs to.
Pick from only the following options:

{{#each options}}- {{this}}
{{/each}}

Respond with only one of the options.`;

const prompt = createChatPrompt<{ options: string[]; input: string }>(
  instruction
).addUserMessage("{{input}}"); // placeholder for message content

// 3. Create a parser that ensures a clean match
const parser = createParser("stringExtract", {
  enum: ["billing", "support", "cancel", "unknown"],
});

// 4. Create the executor
const classifyMessage = createLlmExecutor({
  llm,
  prompt,
  parser,
});

// 5. Pass in options and a message — like a real function!
// classifyMessage.execute is typed based on the prompt/parser!
const result = await classifyMessage.execute({
  input: "Hi, I'm moving and no longer need this service.",
  options: ["billing", "support", "cancel", "unknown"],
});

console.log(result); // => "cancel"
```

### Further Reading

[Find llm-exe on Medium](https://medium.com/llm-exe)

- [Prompt: Create Typed, Modular Prompt Templates in TypeScript](https://medium.com/llm-exe/llm-exe-intro-prompt-3d9d40dc923d)
- [LLM: Keep Your Code Clean While Switching Models](https://medium.com/llm-exe/llm-exe-intro-llm-2f5f35e60caf)
- [Parser: Parse, Validate, and Structure AI Responses](https://medium.com/llm-exe/llm-exe-intro-parser-aed787f81082)
- [Executor: Prompt, Parse, and Execute with Type Safety](https://medium.com/llm-exe/llm-exe-intro-llm-executor-52bb95c76c84)
