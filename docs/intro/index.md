---
title: "Build LLM-Powered Functions in TypeScript | llm-exe"
description: "See how llm-exe simplifies LLM-powered functions in TypeScript by structuring prompts, executors, and parsers into reusable, testable components."
---

# Introduction

When writing llm-powered functions, you'll end up repeating a lot of code, and will end up needing some structure. A prompt may seem simple, but as your instructions grow, you may end up needing to add some more advanced abstractions. Likewise, if you're calling an llm in various functions in your code, you'll end up writing some wrapper around the llm so that you can share functionality like logging, collecting metrics, handling failures/timeouts/retry/etc. Furthermore, the LLM will be returning a string that you may need to validate or parse into a usable data type. Will you be duplicating code? Or creating sharable output parsers.

This package aims to be those lightweight abstractions.

Take the example below. In the first block, there is a function that takes an input, and responds yes or no

##  Example: A llm-powered function - Yes/No bot.
::: danger NOTE
This example does not use llm-exe
:::

This example uses the OpenAi nodejs package directly. Its likely where you'd start. It works, but as I'll explain below, its more of a proof of concept.
```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function YesOrNoBot(
  question: string
): Promise<{ response: string }> {
  const model = "gpt-4o-mini";

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are not an assistant, I need you to reply with only
  'yes' or 'no' as an answer to the question below. Do not explain yourself
  or ask questions. Answer with only yes or no.`,
    },
    {
      role: "user",
      content: question,
    },
    {
      role: "system",
      content: `yes or no:`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: model,
    messages,
    temperature: 0,
    max_tokens: 160,
  });

  const [choice] = response.choices;
  const content = choice.message?.content ?? "";
  if (choice.finish_reason !== "stop") {
    console.log("error finish reason");
  }
  let cleanResponse = content.trim();
  return { response: cleanResponse };
}
```

##  Example (with llm-exe) : A llm-exe-powered function Yes/No bot.
::: tip
This example does use llm-exe!
:::
This example uses llm-exe to accomplish the same task.
```ts
import * as llmExe from "llm-exe";

export async function YesOrNoBot<I extends string>(input: I) {
  const llm = llmExe.useLlm("openai.gpt-4o-mini");

  const instruction = `You are not an assistant, I need you to reply with only 
  'yes' or 'no' as an answer to the question below. Do not explain yourself 
  or ask questions. Answer with only yes or no.`;

  const prompt = llmExe
    .createChatPrompt(instruction)
    .addUserMessage(input)
    .addUserMessage(`yes or no:`);

  const parser = llmExe.createParser("stringExtract", { enum: ["yes", "no"] });
  return llmExe.createLlmExecutor({ llm, prompt, parser }).execute({ input });
}
```

This is a simple example, but to highlight some key differences:
- The example uses OpenAI, but you could use a different model from a different vendor.
- The llm-exe version is structured in a way that each component could be testable. 
- Extra configuration details are hidden away.
- Parsing the output - the llm-exe version enforces the output we desire, and makes sure it is well-typed, without needing to deal with the response.
