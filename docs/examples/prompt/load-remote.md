---
title: "Load LLM Prompts from a Remote Source | llm-exe"
description: "Load prompt templates from GitHub, S3, or a CMS at runtime and use them with typed llm-exe executors in TypeScript, updating prompts without redeploying."
---

# Loading Prompts Remotely

In `llm-exe`, prompts are just strings. You’re not locked into template literals or writing inline strings in your code.

You can:

- Load prompts from GitHub, S3, Notion, a CMS—anywhere
- Edit them without shipping new code
- Plug in data later, with no runtime hacks
- Use templating like Handlebars (optional, built-in)

This opens up a different way to think about prompt engineering. Instead of burying prompts deep in app logic, you treat them like content.

---

## Why It Matters

Pulling prompts out of your codebase means:

- You can ship prompt updates without redeploying
- PMs and writers can own copy, logic, even behavior
- Prompts become versioned assets—reviewed, tested, and evolved like product content
- Your app becomes more dynamic: swap prompts based on user type, time, A/B test, etc.

And since `llm-exe` prompts can be templated, you don’t even need the data when you define the prompt. You can plug in values at runtime—just like rendering a view. No more brittle string concat. No more mixing logic into prompt construction.

---

## Minimal Example

Here’s a prompt hosted on GitHub Gist:

[https://gist.githubusercontent.com/gregreindel/b8828053988fc8ffeb...](https://gist.githubusercontent.com/gregreindel/b8828053988fc8ffeb4d4e26da5f7c42/raw/816ff086727ae38a887524ecc2448a52abba2e59/example-write-function-prompt.md)

```ts
// 1. Load the remote prompt template (from GitHub, S3, CMS, etc)
const promptUrl = `https://gist.githubusercontent.com/gregreindel/b8828053988fc8ffeb4d4e26da5f7c42/raw/816ff086727ae38a887524ecc2448a52abba2e59/example-write-function-prompt.md`;
const res = await fetch(promptUrl);
const promptText = await res.text();

// 2. Define the expected inputs for the template
const prompt = createChatPrompt<{
  functionCode: string;
  existingTests: string[];
  failureCases: string[];
  mode: "strict" | "basic";
}>(promptText);

// 3. Create an LLM executor with your LLM, prompt, and output parser
const executor = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),
  parser: createParser("markdownCodeBlock"), // We expect a single code block back
  prompt,
});

// 4. Execute with real values — you can swap these at runtime
const result = await executor.execute({
  functionCode: "function add(a, b) { return a + b }",
  existingTests: [],
  failureCases: ["add(1, null)", "add(undefined, 2)"],
  mode: "strict", // Tells the prompt to go deep on edge cases
});
```

---

## Takeaways

- Prompts are just strings — load them from anywhere
- You can plug in data later, using real templating
- You’re not stuck with inline strings or template literals
- Update prompts without touching your app code
