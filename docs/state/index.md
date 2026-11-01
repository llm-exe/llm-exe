---
title: "Manage LLM State, Context, and Memory | llm-exe"
description: "Give your LLM apps memory with the llm-exe state module. Manage dialogues, typed context items, and attributes to track conversation data in TypeScript."
---

# State

When calling an LLM from your code, the LLM only knows the history you provide it.

When using llm-exe, the state is something you need to manage. To help provide a concept of memory to your LLM's, we provide a simple state module. 

The state module consists of 3 concepts:
- Dialogues
- Context
- Attributes

Dialogues are a place to store conversation history, internal dialogues, really any conversation that is taking place with an LLM. You can have one or many dialogues. When you create a new dialogue, you should provide a key, which allows you to access the dialogue from the state later if needed.

**Context** items are instances of `BaseStateItem` — typed classes with `getValue()`, `setValue()`, and `resetValue()` methods. Use context for structured, typed data that needs its own lifecycle (e.g., extracted entities, session config). Create context items with `createStateItem(name, defaultValue)` and add them via `state.createContextItem(item)`.

```ts
import { createState, createStateItem } from "llm-exe";

const state = createState();

// Create a typed context item with a name and default value
const userIntent = createStateItem("userIntent", "unknown");

// Add it to the state
state.createContextItem(userIntent);

// Use getValue/setValue to manage the item
userIntent.getValue();    // "unknown"
userIntent.setValue("booking");
userIntent.getValue();    // "booking"
userIntent.resetValue();  // resets to "unknown"
```

**Attributes** are a simple key-value store for lightweight metadata. Use `state.setAttribute(key, value)`, `state.deleteAttribute(key)`, and `state.clearAttributes()`.

## Creating State

Initializing a state object is simple:
```ts
import { createState } from "llm-exe";

const state = createState();
```

## Dialogues

If you want to store a chat conversation dialogue, create one on the state:
```ts
const state = createState();

// this creates a new dialogue in the state, and returns it
const chatHistory = state.createDialogue("chatHistory");

// add messages directly
chatHistory.setUserMessage("Hey anyone there?");

// or retrieve from state later
state.getDialogue("chatHistory").setAssistantMessage("Yep! What's up?");
```

You can also create a standalone dialogue without state using `createDialogue`. See the [Dialogue](/state/dialogue) page for full details.

## Saving State

The `DefaultState` class implements `saveState()` with a warning log by default. To persist state, extend `DefaultState` and override it with your own save logic:

```ts
import { DefaultState } from "llm-exe";

class MyState extends DefaultState {
  async saveState() {
    const data = {
      dialogues: this.dialogues,
      attributes: this.attributes,
    };
    await db.save("state", JSON.stringify(data));
  }
}
```