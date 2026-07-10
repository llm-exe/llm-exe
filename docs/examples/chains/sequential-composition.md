---
title: "Chain Sequential LLM Calls in TypeScript | llm-exe"
description: "Compose LLM calls in sequence with TypeScript: one executor outlines a story, the next writes it — a typed, modular pattern for multi-step LLM workflows."
---

# Story Writing with Sequential Composition of LLM Calls

In llm-exe, each LLM call can be encapsulated as a function (an LLM executor) with defined input/output types. You can then call these executors in sequence using regular TypeScript code, passing along data from one to the next. This chaining enables workflows like first analyzing a problem, then solving it, then formatting the result – each with a dedicated prompt and parser. The strength of llm-exe’s design is that it encourages composability: you assemble complex workflows from simple, reusable components.

For example, imagine we want to generate a short story based on a high-level idea. We’ll use two LLM executors in sequence: one to create an outline, and another to write the story from that outline. The first executor ensures structure, and the second builds on it – a clear separation of concerns.

#### 1: Generate a Story Outline Function

Transforms a high-level idea into structured bullet points.

<<< ../../../examples/chains/sequential-composition/createOutline.ts#file

#### 2. Turn Outline into Full Story Function

Writes the narrative using the structure from step one.

<<< ../../../examples/chains/sequential-composition/createStoryFromOutline.ts#file

#### 3. Composing the Workflow

Calls both executors in sequence to produce the final story.

<<< ../../../examples/chains/sequential-composition/generateStory.ts#file

In this example, two LLM functions are chained: createOutline produces structured output (an array of outline points), and createStoryFromOutline consumes that output to produce the final narrative. Each executor is a self-contained unit with its own prompt and parser. We use a built-in parser listToArray to easily transform the outline from a markdown list to a string[]. Thanks to llm-exe’s type safety, the TypeScript compiler knows that outline is an array of strings, and that story will be a string.

## Why This Pattern Works Well in llm-exe

By dividing the task into clear stages, we gain modular abstraction. The outline generator and story writer can be developed and tested independently – improving one doesn’t risk breaking the other. This modularity is a core strength of llm-exe. Alternative approaches (like a single giant prompt or less-typed frameworks) can make it hard to debug where things went wrong or to adjust one part of the logic. In contrast, llm-exe’s executors behave like normal async functions, so you can log intermediate results, apply conditional logic, or reuse outputs easily.

Execution clarity is another benefit: reading the code, it’s obvious that first we get an outline, then we write the story. There’s no hidden magic – each LLM call is explicit. This means that complex reasoning can be orchestrated transparently in code. Such a chain is far easier to maintain than instructing the LLM to "do step 1, then step 2, then step 3" all in one prompt and hoping it interprets correctly.

Finally, this pattern showcases composability. You might swap out the createStoryFromOutline for a different one (say, a poem writer) and reuse the same outline from the first step. Because llm-exe prompts and executors are modular, reusing outputs in new contexts is straightforward. Overall, chaining LLM functions with llm-exe allows you to build sophisticated multi-step workflows that you control, while keeping each step simple and focused on a single task.
