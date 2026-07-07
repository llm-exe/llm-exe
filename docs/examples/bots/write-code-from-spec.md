---
title: "Generate TypeScript Code from a Spec with an LLM | llm-exe"
description: "Turn a plain-text specification into working TypeScript code with an LLM, using a markdown code block parser to reliably extract the generated function."
---

# **Write Code From Spec**

This example shows how to create a simple LLM function that generates TypeScript code from a plain-text specification. It's ideal when you want a quick implementation based on a natural language prompt.

---

### Step 1 – Prepare the Prompt

We define the LLM instructions using a templated string. The prompt tells the LLM to act as an expert developer and return only TypeScript code, no prose.

<<< ../../../examples/writeCodeFromSpec.ts#prompt

**Tip:** You want to instruct the llm to respond with the markdown code block - this improves the reliability of code extraction with the parser.

---

### Step 2 – Define the Function

This function configures the LLM, applies the prompt, and parses the response using `markdownCodeBlock`. It wraps everything into a single executor.

<<< ../../../examples/writeCodeFromSpec.ts#function

**Why this setup?**
By separating the prompt and parser setup, the function remains readable and testable. It also allows you to swap in new prompts or models easily.

---

### Step 3 – Use it

Here’s how you can call the `writeCodeFromSpec` function to generate code dynamically:

````ts
import { writeCodeFromSpec } from "./your-path";

const code = await writeCodeFromSpec("a function that adds two numbers");

console.log(code);
/**
 * ```ts
 * { "code": "function add(a: number, b: number): number {\nreturn a + b;\n", "language": "typescript" }
 * ```
 */
````

---

### Complete File

<<< ../../../examples/writeCodeFromSpec.ts#file
