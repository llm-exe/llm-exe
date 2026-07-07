---
title: "Manage Chat History and Conversation State in TypeScript | llm-exe"
description: "Use the Dialogue class to manage chat history for multi-turn LLM conversations in TypeScript. Add messages, load history, and capture LLM output automatically."
---

# Dialogue

The `Dialogue` class manages conversation history for multi-turn LLM interactions. It's used internally by `state`, but you can also use it independently with `createDialogue`.

## Creating a dialogue

```ts
import { createDialogue } from "llm-exe";

const dialogue = createDialogue("chat");
```

## Adding messages

All message methods return `this` for chaining:

```ts
dialogue
  .setSystemMessage("You are a helpful assistant.")
  .setUserMessage("What is TypeScript?")
  .setAssistantMessage("TypeScript is a typed superset of JavaScript.");
```

### Available methods

| Method | Description |
|--------|-------------|
| `setUserMessage(content, name?)` | Add a user message. Content can be a string or detailed content array. |
| `setAssistantMessage(content)` | Add an assistant message. Accepts a string or `OutputResultsText`. |
| `setSystemMessage(content)` | Add a system message. |
| `setToolMessage(content, name, id?)` | Add a tool/function result message. |
| `setToolCallMessage({ name, arguments, id? })` | Add a tool call (function invocation) message. |
| `setFunctionCallMessage(input)` | Add a function call message (legacy format also supported). |
| `setMessageTurn(user, assistant, system?)` | Add a complete turn (user + assistant + optional system). |
| `setHistory(messages)` | Load an array of messages into the dialogue. |
| `getHistory()` | Get all messages as an `IChatMessages` array. |
| `addFromOutput(output)` | Add messages from an LLM `OutputResult` or `BaseLlCall`. |

## Adding LLM output directly

After making an LLM call, you can add the response to dialogue history automatically:

```ts
const output = await llm.call(prompt);
dialogue.addFromOutput(output);
```

This handles both text responses and tool/function calls, adding them in the order they were returned.

## Loading existing history

Use `setHistory` to load a full conversation from an array:

```ts
dialogue.setHistory([
  { role: "user", content: "Hi" },
  { role: "assistant", content: "Hello! How can I help?" },
  { role: "user", content: "Tell me a joke" },
]);
```

## Using with state

Dialogues integrate with the state module:

```ts
import { createState } from "llm-exe";

const state = createState();
const chatHistory = state.createDialogue("chatHistory");

chatHistory.setUserMessage("Hello!");
chatHistory.setAssistantMessage("Hi there!");

// Retrieve later
const history = state.getDialogue("chatHistory").getHistory();
```

## Examples

<GenericOutput example="state.dialogue.basic.exampleOne">

<<< ../../examples/state/dialogue/basic.ts#exampleOne
</GenericOutput>


<GenericOutput example="state.dialogue.functions.dialogueWithFunctionCall">

<<< ../../examples/state/dialogue/functions.ts#dialogueWithFunctionCall
</GenericOutput>
