---
title: "Build Callable Tools for LLM Agents in TypeScript | llm-exe"
description: "Wrap TypeScript functions and executors into callable tools with createCallableExecutor, then group them with useExecutors to validate and invoke tools by name."
---

## Callable Executor Wrapper

When building LLM agents that need to call tools or functions, `createCallableExecutor` wraps your executors (or plain functions) into a standardized interface. Use `useExecutors` to group them into a collection you can query and invoke by name.

### Creating a callable executor

Use `createCallableExecutor` to wrap a handler function or an existing executor.

**Config properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique name used to look up and invoke the function |
| `description` | `string` | Yes | Description of what the function does (shown to the LLM) |
| `input` | `string` | Yes | JSON-stringified schema describing the expected input shape |
| `handler` | `function \| BaseExecutor` | No | The function to execute, or an existing executor instance |
| `parameters` | `Record<string, any>` | No | Additional static parameters passed alongside the input |
| `attributes` | `Record<string, any>` | No | Metadata attributes returned with the result |
| `visibilityHandler` | `function` | No | Controls whether this function is visible in a given context |
| `validateInput` | `function` | No | Validates input before execution |

```ts
import { createCallableExecutor, createLlmExecutor, useLlm, createChatPrompt, createParser } from "llm-exe";

// Wrap a plain function
const searchCallable = createCallableExecutor({
  name: "searchInternet",
  description: "Search the internet for information",
  input: JSON.stringify({
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
    },
  }),
  handler: async (input: { query: string }) => {
    // your search logic here
    return { results: [`Result for: ${input.query}`] };
  },
});

// Or wrap an existing LlmExecutor
const summarizeExecutor = createLlmExecutor({
  llm: useLlm("openai.chat.v1", { model: "gpt-4o-mini" }),
  prompt: createChatPrompt("Summarize: {{input}}"),
  parser: createParser("string"),
});

const summarizeCallable = createCallableExecutor({
  name: "summarize",
  description: "Summarize the given text",
  input: JSON.stringify({
    type: "object",
    properties: {
      input: { type: "string", description: "Text to summarize" },
    },
  }),
  handler: summarizeExecutor,
});
```

### Grouping with `useExecutors`

`useExecutors` groups callables into a collection with lookup and invocation methods:

```ts
import { useExecutors } from "llm-exe";

const executors = useExecutors([
  searchCallable,
  summarizeCallable,
]);

// Check if a function exists
executors.hasFunction("searchInternet"); // true

// Get a function by name
const fn = executors.getFunction("searchInternet");

// Call a function by name — input is parsed from a JSON string
const result = await executors.callFunction(
  "searchInternet",
  JSON.stringify({ query: "llm-exe docs" })
);
// result: { result: any, attributes: any }

// Get all functions (useful for building tool lists)
const allFunctions = executors.getFunctions();
```

### Optional features

**Visibility handler** — conditionally show/hide functions based on context:

```ts
const adminCallable = createCallableExecutor({
  name: "deleteUser",
  description: "Delete a user account",
  input: JSON.stringify({
    type: "object",
    properties: {
      userId: { type: "string", description: "The ID of the user to delete" },
    },
  }),
  handler: async (input: { userId: string }) => { /* ... */ },
  visibilityHandler: (input, context, attributes) => {
    return attributes?.role === "admin";
  },
});

// Only returns functions visible for the given context
const visible = executors.getVisibleFunctions(input, { role: "admin" });
```

**Input validation** — validate input before execution:

```ts
const callable = createCallableExecutor({
  name: "sendEmail",
  description: "Send an email",
  input: JSON.stringify({
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body content" },
    },
  }),
  handler: async (input: { to: string; subject: string; body: string }) => { /* ... */ },
  validateInput: async (input) => {
    if (!input.to) {
      return { result: false, attributes: { error: "Missing 'to' field" } };
    }
    return { result: true, attributes: {} };
  },
});

const validation = await executors.validateFunctionInput(
  "sendEmail",
  JSON.stringify({ subject: "Hi" })
);
// validation: { result: false, attributes: { error: "Missing 'to' field" } }
```

### Callable Errors

Callable executor failures use structured `LlmExeError` codes:

| Code | Meaning |
| --- | --- |
| `callable.invalid_handler` | The callable was created without a valid function or executor handler |
| `callable.handler_not_found` | `useExecutors` could not find a callable with the requested name |
| `callable.validation_failed` | Callable input validation failed |

Use `isLlmExeError` to check callable failure codes.

```ts
try {
  await executors.callFunction("sendEmail", input);
} catch (error) {
  if (isLlmExeError(error, "callable.handler_not_found")) {
    // Ask the model to choose one of the available functions.
  }
}
```

### Using with an LLM agent loop

A typical agent pattern: the LLM decides which function to call, and you execute it:

```ts
const executors = useExecutors([
  finalAnswerCallable,
  interactWithUserCallable,
  searchInternetCallable,
  takeNotesCallable,
]);

const functionWithCallableExecutors = async (input: {
  action: string;
  input: string;
  thought: string;
}) => {
  return executors.callFunction(input.action, input.input);
};
```
