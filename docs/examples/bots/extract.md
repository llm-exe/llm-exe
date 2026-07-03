---
title: "Extract Structured Data from Text with an LLM | llm-exe"
description: "Extract structured data from conversations with an LLM in TypeScript, using a JSON schema to pull typed fields like cities and dates from natural language."
---

## Extract 

In this example, we will create a function that is able to tell the intent of the user's most recent message in the conversation.

This can be useful as:
- First step in a pipeline to filter options

This takes advantage of a custom output parser to not only ensure formatting, but slightly transform the output.

#### Step 1 - Prepare Types & Intents

<<< ../../../examples/extractBot.ts#types

#### Step 2 - Prepare Prompt

<<< ../../../examples/extractBot.ts#prompt


#### Step 3 - Create LLM Executor
Combine the prompt, LLM, and parser into a single function.

<<< ../../../examples/extractBot.ts#function



#### Step 4 - Use it!

```typescript
  const schema = defineSchema({
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "what city does the user want to book a hotel in",
        default: "unknown",
      },
      startDate: {
        type: "string",
        description: "the date the user would like to start their stay",
        default: "unknown",
      },
      endDate: {
        type: "string",
        description: "the date the user would like to end their stay",
        default: "unknown",
      },
    },
    required: ["city", "startDate", "endDate"],
    additionalProperties: false,
  });
```


```ts
import { extractInformation } from "./somewhere"

// a chat history, loaded from somewhere
const chatHistory = [];

const response = await extractInformation({
    // the input you get from somewhere
    input: "I'm going to be in berlin",
    chatHistory
}, schema);

/**
 * 
 * console.log(response)
 * {
 *   "city": "Berlin",
 *   "startDate": "unknown",
 *   "endDate": "unknown",
 * }
 **/

// the intent is focused on the most recent message
chatHistory.push({ 
    role: "user",
    content: "I'm going to be in berlin"
});

const response2 = await extractInformation({
    input: "I get there the 14th and leave the 18th",
    chatHistory
}, schema);

/**
 * 
 * console.log(response)
 * {
 *   "city": "Berlin",
 *   "startDate": "06/14/2023",
 *   "endDate": "06/18/2023",
 * }
 **/
```

### Complete File

<<< ../../../examples/extractBot.ts#file