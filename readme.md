# llm-exe

[![tests](https://github.com/llm-exe/llm-exe/actions/workflows/tests.yml/badge.svg)](https://github.com/llm-exe/llm-exe/actions/workflows/tests.yml) [![Coverage Status](https://coveralls.io/repos/github/llm-exe/llm-exe/badge.svg?branch=main)](https://coveralls.io/github/llm-exe/llm-exe?branch=main) [![npm version](https://badge.fury.io/js/llm-exe.svg)](https://badge.fury.io/js/llm-exe)

> Upgrading from llm-exe 2.x to 3.x? Read the [v2 to v3 migration guide](https://llm-exe.com/misc/v2-to-v3-migration-guide.html) before updating. It covers parser and output-boundary changes that may require code updates.

A package that provides simplified base components to make building and maintaining LLM-powered applications easier.

- Write functions powered by LLMs with easy-to-use building blocks.
- Pure JavaScript and TypeScript. Allows you to pass and infer types.
- Supercharge your prompts by using [Handlebars](https://handlebarsjs.com/) within prompt template.
- Parsers turn the LLM's text reply into typed values (JSON, numbers, booleans, lists, and more).
- Support for text-based and chat-based prompts. (ChatGPT, Claude, Grok, Gemini, Bedrock, Ollama, etc)
- Call LLMs from different providers without changing your code. (OpenAI/Anthropic/xAI/Google/AWS Bedrock/Ollama/DeepSeek)
- Allow LLM's to call functions (or call other LLM executors).
- Not very opinionated. You have control on how you use it.

![llm-exe project logo](https://assets.llm-exe.com/llm-exe-featured-2025.png)

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

Set your provider's API key in the environment (for example `OPENAI_API_KEY`), or pass it as an option (`useLlm("openai.gpt-4o-mini", { openAiApiKey: "..." })`). See [LLM providers](https://llm-exe.com/llm/) for each provider's key.

To try llm-exe without a key, use `useLlm("openai.chat-mock.v1")`. It makes no network call. By default it replies with the fixed text `Hello world from LLM! The input was [...]` (the prompt messages as JSON), which typed parsers can't reliably parse. Pass `mockResponse` to choose the reply, so typed parsers like `json`, `number`, or `boolean` work too: `useLlm("openai.chat-mock.v1", { mockResponse: '{"a":1}' })`.

## Overview

```ts
import { useLlm, createChatPrompt, createParser, createLlmExecutor, defineSchema } from "llm-exe";

// Prompt — the generic types the input; `{{input}}` is filled in from execute()
const prompt = createChatPrompt<{ input: string }>(
  "You are a support agent. Help the user."
);
prompt.addUserMessage("{{input}}");

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
const result = await executor.execute({ input: "I need help with my order." });
// result is typed as { answer: string; action: string }
```

Every key you pass to `execute()` fills the matching `{{...}}` placeholder in the prompt. The parser turns the LLM's text reply into a typed value, and that type becomes the executor's return type.

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
createParser("boolean");             // whole response must be a boolean ("yes", "true"); "Yes." throws
createParser("boolean", { match: "extract" }); // finds one boolean token in surrounding text
createParser("number");              // extracts number from response (default match: "extract")
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
const parser = createCustomParser("MyUppercaseParser", (text, context) => {
  return text.toUpperCase();
});
```

`text` is the LLM's reply. `context` is the per-call `ExecutionContext`: `traceId`, `executor` (name, id), `execution` (this run's `input`, timing, and the raw LLM response as `handlerOutput`; the parsed `output` doesn't exist yet), and `attributes`. The return type of your function becomes the executor's return type.

#### State

Manage conversation history and structured data across LLM calls:

```ts
import { createState, createDialogue, createStateItem, createChatPrompt } from "llm-exe";
import type { IChatMessages } from "llm-exe";

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

// Put the history into a prompt
const chatPrompt = createChatPrompt<{ chat: IChatMessages }>("You are helpful.");
chatPrompt.addChatHistoryPlaceholder("chat");
chatPrompt.format({ chat: chat.getHistory() });

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
