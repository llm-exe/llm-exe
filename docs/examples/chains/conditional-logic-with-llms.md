---
title: "Conditional Logic and Branching in LLM Orchestration | llm-exe"
description: "Use an LLM classifier to branch between specialized executors in TypeScript, with plain if/else logic routing questions to factual or creative handlers."
---

# Conditional Logic and Branching in LLM Orchestration

Not all workflows are linear; often you need to branch based on some condition. With llm-exe, you can incorporate standard control flow (if/else logic) by using LLM outputs to guide decisions. This enables dynamic chains where, for example, the response from one LLM determines which of several subsequent LLM executors to invoke. Conditional orchestration is crucial for handling varied inputs or multi-step dialogues, and llm-exe’s design makes it easy to mix LLM calls with imperative logic in TypeScript.

## Using LLMs to Drive Decisions

A common pattern is to first use a “classifier” LLM function to interpret or categorize input, then branch to a specialized handler based on that result. Each branch can be an LLM executor tailored to a specific task or domain. By structuring it this way, your prompts remain focused (each executor does one thing well), and your code controls the high-level flow. This approach highlights readability: rather than one monolithic prompt trying to handle all cases, the branching logic is clearly visible in code.

Let’s walk through an example scenario. Suppose we’re building a Q&A agent that sometimes needs to provide a straightforward factual answer, and other times should give a creative, narrative response. We can use one LLM function to decide which style is appropriate, then route to either a “factual answer” executor or a “creative answer” executor accordingly.

## The Code

#### 1. Classifier executor: Determine if the query is asking for factual or creative response.

<<< ../../../examples/chains/conditional-logic-with-llms/createClassificationExecutor.ts#file

#### 2. Factual answer executor (for technical questions).

<<< ../../../examples/chains/conditional-logic-with-llms/createFactualExecutor.ts#file

#### 3. Creative answer executor (for creative questions).

<<< ../../../examples/chains/conditional-logic-with-llms/createCreativeExecutor.ts#file

#### 4. Orchestration function that uses the classifier result to choose a path.

<<< ../../../examples/chains/conditional-logic-with-llms/answerQuestion.ts#file

## Example Usage

```typescript
const question = "How does photosynthesis work?";
const answer = await answerQuestion(question);
console.log(answer);
```

In this example, the classifier LLM function looks at the input question and labels it. We used an enum parser to restrict outputs to the two expected categories (`"technical"` or `"creative"`). Depending on the result, we then invoke either `factualExecutor` or `creativeExecutor`. Each of those executors has a prompt tuned to produce the right style of answer. The branching `if/else` is just regular TypeScript – llm-exe doesn’t impose a new DSL for control flow, which keeps the logic intuitive.

## Dynamic Chains and Modular Handlers

This conditional pattern can scale to more complex decision trees. You could have multiple categories and a different LLM executor for each. With llm-exe’s modular abstraction, each handler can be developed independently. For instance, if you wanted to handle math questions differently, you could add a “math” category and an executor that maybe breaks down and solves math problems. The key is that the orchestration function (`answerQuestion` in our example) cleanly captures the decision logic in code.

Why is llm-exe especially suited for this? Compared to all-in-one prompting or certain frameworks, llm-exe keeps the branching explicit and readable. Alternatives might encourage writing the prompt to handle branching internally (leading to complex prompt engineering) or using chain frameworks that hide logic in configuration. Here, we see exactly which path is taken and which prompt is used. This clarity makes maintenance and debugging far easier – if the creative answers are off, you know to adjust `creativePrompt` without touching the factual flow.

Moreover, because each branch is a normal function call, you can log or inspect intermediate values (`category` in this case), integrate validation, or even override the decision logic manually if needed. The execution clarity of llm-exe means the high-level reasoning (the policy of the agent) is under your control, not buried inside an LLM’s black box. In sum, conditional orchestration with llm-exe leverages the strengths of programming (explicit control flow) combined with the power of LLMs (flexible understanding and generation), giving you the best of both worlds.

## Common Questions

### How do you handle conditional branching based on LLM outputs?

Constrain the LLM's output to a fixed set of values with a parser, then branch on the result with ordinary `if`/`else` or `switch` statements. The critical step is the constraint: an enum-restricted parser guarantees the output is one of your known categories, so your branching code never has to handle free-form text. In llm-exe, `createParser("stringExtract", { enum: [...] })` returns a typed union — TypeScript will even warn you if a `switch` misses a case. For binary decisions, the [boolean parser](/parser/included-parsers#boolean-parser) is even simpler — see [Get a Yes/No Decision from an LLM](/examples/bots/yes-no).

### Can you branch on sentiment or other analysis from an LLM?

Yes — sentiment routing is the same classify-then-branch pattern. Have an executor return one of a fixed set of sentiment labels, then route on the typed result:

```typescript
const sentiment = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),
  prompt: createChatPrompt<{ message: string }>(
    "Classify the sentiment of this message as positive, neutral, or negative: {{message}}"
  ),
  parser: createParser("stringExtract", {
    enum: ["positive", "neutral", "negative"],
  }),
});

const result = await sentiment.execute({ message: ticket.body });
// result is typed as "positive" | "neutral" | "negative"

if (result === "negative") {
  await escalateToHuman(ticket);
} else {
  await sendAutoReply(ticket);
}
```

The same shape works for any analysis you can express as categories: urgency, topic, language, toxicity, purchase intent.

### How do chains handle branching logic and conditional paths?

There are two approaches. Chain frameworks typically model branches as configuration — router nodes, edges in a graph, or DSL constructs you learn and debug through the framework. llm-exe takes the other approach: a "chain" is just a function that awaits executors in sequence, so a conditional path is a plain `if` statement between two `await` calls. There is nothing new to learn, breakpoints and stack traces work normally, and the decision logic is visible in the code rather than in a config file.

### How does conditional logic work in document routing?

Document routing is classification followed by a dispatch: classify the document into a known type, then hand it to the pipeline for that type.

```typescript
const classifyDocument = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),
  prompt: createChatPrompt<{ text: string }>(
    "Classify this document as an invoice, contract, or resume: {{text}}"
  ),
  parser: createParser("stringExtract", {
    enum: ["invoice", "contract", "resume"],
  }),
});

const docType = await classifyDocument.execute({ text: documentText });

switch (docType) {
  case "invoice":
    return processInvoice(documentText);
  case "contract":
    return reviewContract(documentText);
  case "resume":
    return parseResume(documentText);
}
```

Because the classifier's output is constrained to the enum, every document lands in exactly one pipeline — there is no "the model said something unexpected" path to handle in your routing code. If the model's raw response doesn't contain one of the allowed values, the parser fails loudly instead of routing the document somewhere wrong.
