---
title: "Replace Complex Code with LLM Functions | llm-exe"
description: "Learn what an LLM function is and how to replace brittle logic like regex with typed, LLM-powered TypeScript functions using llm-exe executors and parsers."
---

# What is an LLM function?

As the usefulness of LLMs grows, you have the ability to replace (at least consider replacing) complex functionality in your application with simple calls to an LLM.

Consider the following pseudo-code for a function that detects Personal Identifiable Information (PII) within the provided input:

```javascript:no-line-numbers
// The existing way to write a function to detect PII. Not using LLM.
function checkIfDocumentContainsPii(input){
  // regex for PII
  // more regex for PII
  // more regex for PII
  // more regex for PII
  // more regex for PII
  // etc
}

// A LLM-powered function
function checkIfDocumentContainsPiiWithLlm(input){
  // ask LLM if the content contains PII
}
```

As you can see, the LLM-powered version allows us to abstract away complex, brittle logic like regex patterns and instead rely on the reasoning abilities of the model—dramatically reducing the amount of code, improving flexibility, and often increasing accuracy.

Here is how you could implement example above with an LLM executor:

```ts
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

export function piiDetector(input: string) {
  const instruction = `You need to check the text below for any of the PII listed below.
  
## PII you are looking for:
email addresses: anything that matches an email address
social security number: a personal social security number or business EIN
credit card number: a credit card number

## You should respond with the template below:
email addresses: <true or false if this type of PII is included>
social security number: <true or false if this type of PII is included>
credit card number: <true or false if this type of PII is included>`;

  const llm = useLlm("openai.gpt-4o-mini");
  const prompt = createChatPrompt(instruction).addUserMessage(input);
  const parser = createParser("listToJson");

  const executor = createLlmExecutor({
    llm,
    prompt,
    parser,
  });

  return executor.execute({ input });
}
```

```ts
/**
 * Example usage
 * Somewhere else in your codebase
 */
const input = "Hello! can you bill me? my cc is 4242-4242-4242-4242!!"
const response = await piiDetector(input)
/**
 *
 * Output:
 *
 * {
 *   emailAddresses: false,
 *   socialSecurityNumber: false,
 *   creditCardNumber: true
 * }
 */
```

The input and output of the `piiDetector` function are strongly typed, providing reliable structure and safety when integrating with the rest of your application.

For a complete, step-by-step build of a function like this — schema, prompt, parser, and inferred types — see [Write a Type-Safe LLM Function](/examples/concepts/type-safe-llm-function).
