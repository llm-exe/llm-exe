---
title: "How to Structure LLM Executor Functions | llm-exe"
description: "Patterns for wrapping LLM executors in reusable TypeScript functions, with tips for organizing prompts, parsers, and types into clean, testable files."
---

# LLM Executor Function Syntax

llm-exe aims to be building blocks, allowing you to use the pieces as you wish. Below are suggestions on how to contain an LLM executor in a way that can be used throughout your application. Ultimately, do what you want.

## LLM Executor Function

All examples below will share this prompt instruction and input interface.

<<< ../../examples/basicFunctions.ts#IntroduceSharedInstructions

### Return an Executor

One way to structure the function is to have the function return the executor its self. This is useful in that it returns an instance of LlmExecutor. You can attach hooks, listen for events, etc.

<<< ../../examples/basicFunctions.ts#llmExecutorExample

When using this approach, whenever you import this function to use, you will need to call execute on it. For example:

```ts{5}
import { llmExecutorExample } from "example-above"

const executor = llmExecutorExample()

executor.on("onSuccess", (result) => {
  console.log("Classification result:", result);
});

executor.on("onError", (error) => {
  console.error("Classification error:", error);
});

const result = await executor.execute({
    userInput: "",
    timeOfDay: ""
})
```

### Return a Value

With this approach, you encapsulate the executor and execution.

<<< ../../examples/basicFunctions.ts#llmExecutorExampleExecute

```ts
import { llmExecutorExample } from "example-above";

const result = await llmExecutorExample({
  userInput: "",
  timeOfDay: "",
});
```

Note the main differences:

1. The function is now an async function
2. The function requires an input (which gets passed into `.execute()`)
3. The LLM executor is executed and the value is returned on every call, rather than the executor.
4. Unless you bind hooks/events within the function, you lose that ability because you're returning the result instead of the executor.

## Structuring Files

When dealing with LLM Executors that have elaborate prompts, custom output parsers, or both, it may be useful to break the components out into different files. For example:

```
llms
- intent-bot
  - index.ts // executor lives here
  - parser.ts // export your parser
  - prompt.ts // export your prompt
  - types.ts // types
```

index.ts

```ts
import { CustomInputType } from "./types";
import { parser } from "./parser";
import { prompt } from "./prompt";

export async function myLlmExecutorExecute(input: CustomInputType) {
  return createLlmExecutor({
    prompt,
    parser,
    llm,
  }).execute(input);
}
```

::: tip
Allowing `prompt` and `parsers` to be imported/exported makes them testable components!
:::

::: tip
You can even load the prompt from a third-party resource. This means your prompt content/logic does not need to be bundled into your app code.
:::

## Other Notes

Its reasonable to pass an llm around.

<<< ../../examples/basicFunctions.ts#llmExecutorExampleNeedsLlm{2}
