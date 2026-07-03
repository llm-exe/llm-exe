---
title: "Intent Classification with LLMs in TypeScript | llm-exe"
description: "Classify user intent from chat messages with an LLM in TypeScript, using a custom output parser to return a typed intent and confidence score you can act on."
---

## Intent 

In this example, we will create a function that is able to tell the intent of the user's most recent message in the conversation.

This can be useful as:
- First step in a pipeline to filter options

This takes advantage of a custom output parser to not only ensure formatting, but slightly transform the output.


#### Step 1 - Prepare Types & Intents

<<< ../../../examples/intentBot.ts#prepare

#### Step 2 - Prepare Prompt

<<< ../../../examples/intentBot.ts#prompt

#### Step 3 - Create Custom Output Parser
While we tell the LLM to format its response as JSON, it's a string. We still need to parse and validate the response so it can be used in our code. A custom output parser will reformat the output from the LLM, and provide typings for our LLM executor.

<<< ../../../examples/intentBot.ts#parser

#### Step 4 - Create LLM Executor
Combine the prompt, LLM, and parser into a single function.

<<< ../../../examples/intentBot.ts#function


#### Step 4 - Use it!


```ts
import { identifyIntent } from "./somewhere"

// a chat history, loaded from somewhere
const chatHistory = [];

const response = await identifyIntent().execute({
    // the input you get from somewhere
    input: "Hey I'll be in town next week and need a car",
    intents,
    chatHistory
});

/**
 * 
 * console.log(response)
 * {
 *   "intent": "rent_car",
 *   "confidence": 90,
 * }
 **/

// the intent is focused on the most recent message
chatHistory.push({ 
    role: "user",
    content: "Hey I'll be in town next week and need a car"
});

const response2 = await identifyIntent().execute({
    input: "Actually I need a place to sleep more",
    intents,
    chatHistory
});

/**
 * 
 * console.log(response)
 * {
 *   "intent": "book_hotel",
 *   "confidence": 90,
 * }
 **/
```

### Complete File
<<< ../../../examples/intentBot.ts#file

### Related

- [Conditional Logic and Branching](/examples/chains/conditional-logic-with-llms.html) — route to different executors based on the detected intent
- [Get a Yes/No Decision from an LLM](/examples/bots/yes-no.html) — the two-outcome version of this pattern
- [Replicating Amazon Lex](/examples/concepts/replicating-lex.html) — intent detection plus slot filling
- [Custom Parsers](/parser/custom.html) — how the custom output parser here works
