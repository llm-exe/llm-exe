---
title: "Validate Statements with an LLM in TypeScript | llm-exe"
description: "Build an LLM-powered validator in TypeScript that checks true/false statements against a conversation, useful as a moderation layer or policy checker."
---

## Validator

In this example, we will create a function that is able to validate whether or not a series of statements is true.

This can be useful as:

- Moderation layer
- Policy checker

This takes advantage of a custom output parser to not only ensure formatting, but slightly transform the output.

#### Step 1 - Prepare Prompt

<<< ../../../examples/Verify.ts#prompt

#### Step 2 - Create Custom Output Parser

While we tell the LLM to format its response as JSON, it's a string. We still need to parse and validate the response so it can be used in our code. A custom output parser will reformat the output from the LLM, and provide typings for our LLM executor.

<<< ../../../examples/Verify.ts#parser

#### Step 3 - Create LLM Executor

Combine the prompt, LLM, and parser into a single function.

<<< ../../../examples/Verify.ts#function

#### Step 4 - Use it!

```ts
import { checkPolicy } from "./somewhere"

// the input you get from somewhere
const input = "";

// a chat history, loaded from somewhere
const chatHistory = [{ role: "user", content: "Hi I'm Greg" }];

// a list of statements we'd like to check
const statements = [
    "The user has told us their age.",
    "The user has told us their name."
]

const response = await checkPolicy({
    mostRecentMessage: input,
    chatHistory,
    statements
})

console.log(response)
/**
 * {
 *   "passed": false,
 *   "results": [{
 *     "statement": "The user has told us their age.",
 *     "answer":"false",
 *     "confidence":"95"
 *    },{
 *      "statement": "The user has told us their name.",
 *      "answer": "true",
 *      "confidence":"80"
 *    }]
 * }
 **
```

### Complete File

<<< ../../../examples/Verify.ts#file
