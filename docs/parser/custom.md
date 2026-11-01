---
title: "Create Custom Parsers for LLM Output | llm-exe"
description: "Define custom parsers to transform LLM output into any shape you need. Return types flow through to the executor for fully typed results in TypeScript."
---

# Custom Parser

You can define a custom parser to have full control over transforming the LLM output into the format you expect.

A custom parser is a function that receives two arguments — the LLM's text response and an executor context object — and returns a transformed result.

When using TypeScript, the return type of your parser function flows through to the executor, so `executor.execute()` returns the correct type automatically.

## Defining a custom parser

```ts
import { createCustomParser } from "llm-exe";

// The return type of the handler becomes the parser's output type.
const customParser = createCustomParser(
  "extractEmails",
  (text: string, context) => {
    // text = the raw LLM response string
    // context = the executor context (input values, metadata)
    const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    return emails; // string[]
  }
);
```

## Using a custom parser

```ts
// Use .parse() directly
const emails = customParser.parse("Contact us at help@example.com", {} as any);
// emails: string[]

// Or use it in an executor — the executor infers the return type
const executor = createLlmExecutor({
  llm: useLlm("openai.chat.v1", { model: "gpt-4o-mini" }),
  prompt: createChatPrompt(`Extract all email addresses from: {{text}}`),
  parser: customParser,
});

const result = await executor.execute({ text: "Email me at hello@test.com" });
// result is typed as string[] — inferred from the parser
```

## Type inference

The key benefit of custom parsers is that their return type propagates to the executor:

```ts
// Parser returns a specific interface
interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
}

const sentimentParser = createCustomParser(
  "sentiment",
  (text: string): SentimentResult => {
    const parsed = JSON.parse(text);
    return {
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
    };
  }
);

const executor = createLlmExecutor({
  llm: useLlm("openai.chat.v1", { model: "gpt-4o-mini" }),
  prompt: createChatPrompt(`Analyze sentiment of: {{text}}`),
  parser: sentimentParser,
});

const result = await executor.execute({ text: "I love this!" });
// result is typed as SentimentResult
```

## Using the `CustomParser` class directly

You can also instantiate the `CustomParser` class directly instead of using `createCustomParser`:

```ts
import { CustomParser } from "llm-exe";

const parser = new CustomParser("myParser", (text: string, context) => {
  return text.toUpperCase();
});
```

Both approaches produce the same result — `createCustomParser` is a convenience wrapper around `new CustomParser()`.
