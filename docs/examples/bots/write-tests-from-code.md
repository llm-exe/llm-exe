---
title: "Generate Jest Tests with an LLM in TypeScript | llm-exe"
description: "Build an LLM-powered test generator in TypeScript that reads a function and writes comprehensive Jest test cases, with markdown code block parsing built in."
---

# Generate Jest Tests

This example creates an LLM-powered test generator that produces comprehensive Jest test cases based on a given TypeScript function.

### Step 1 - Prompt Template

This prompt encourages high-coverage testing and supports injecting stylistic preferences or test conventions if available.

<<< ../../../examples/writeTestsFromCode.ts#prompt

### Step 2 - LLM Executor Function

The function wraps the `llm-exe` tools to build a complete execution pipeline for generating test cases in markdown format.

<<< ../../../examples/writeTestsFromCode.ts#function

### Example Usage

````ts
import { generateTests } from "<your-file-path>";

const fn = `function sum(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error("Invalid input");
  }
  return a + b;
}`;

const response = await generateTests(fn);

console.log(response.code);
/**
 * ```ts
 * it('should add two numbers', () => {
 *   expect(sum(2, 3)).toBe(5);
 * });
 * // More tests...
 * ```
 */
````

> 💡 **Tip**: Pass in `exampleTests` to guide style or mocking expectations.

### Complete File

<<< ../../../examples/writeTestsFromCode.ts#file
