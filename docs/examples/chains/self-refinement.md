---
title: "Build an LLM Self-Refinement Loop in TypeScript | llm-exe"
description: "Implement a self-refinement loop in TypeScript: one LLM executor drafts an answer, another validates it, and a simple loop retries until criteria are met."
---

# Basic Self-Refinement Loop

Sometimes an LLM’s first output isn’t correct or complete, and you want to iterate until a certain condition is met. With llm-exe, you can implement self-refinement loops where an LLM’s output is fed back into another step (or even back into itself with adjusted input) to improve the result. This pattern is akin to an LLM “thinking aloud” or checking its work, and it’s crucial for tasks that benefit from verification or stepwise correction. By using multiple LLM executors for generation and evaluation, you maintain modular clarity: one part generates a solution, another part evaluates it, and your code orchestrates the retry logic.

## When to Use Self-Refinement

Consider tasks like complex question answering, code generation with tests, or any scenario with requirements/constraints. An initial answer may fall short, so you need a way to detect issues and prompt the model to fix them. Rather than relying on a single prompt to do this internally (which is hard to control), you can explicitly break it down:

- A solver LLM function that attempts an answer/solution.
- A validator LLM function that checks the solution against criteria or finds errors.
- Looping logic that uses the validator’s feedback to decide whether to iterate again.

This separation is powerful – each LLM function is focused and easier to prompt: one to solve, one to critique. And your TypeScript loop enforces the stopping condition or maximum iterations for safety.

## Example: Iterative Answer Improvement

Let’s illustrate a simplified self-refinement loop. Suppose we want an LLM to answer a question, but we want to ensure the answer contains a specific keyword and is under a word limit. We’ll use one executor to draft an answer, another to evaluate it, and a loop to refine the answer until it meets the criteria or we give up after a few tries.

#### Generate Answer Function

<<< ../../../examples/chains/self-refinement/generateAnswer.ts#file

#### Check Answer Function

<<< ../../../examples/chains/self-refinement/checkAnswer.ts#file

#### Generate and Refine Function

Combine them! We call the functions, and put them in a standard js loop.

<<< ../../../examples/chains/self-refinement/getRefinedAnswer.ts#file

In this code, generateAnswer generates an answer given the question and a required keyword. The prompt explicitly tells the model the constraints (must include a word and be short). Then checkAnswer parses the answer to a structured JSON result indicating whether the criteria are met. The loop will repeat up to 3 times, stopping early if both conditions pass. We log the outcome of each attempt for transparency.

Several things to note:

- We used a JSON parser for the validator’s output to get a reliable structured response ({ hasWord: boolean, underLimit: boolean }). This makes it easy to inspect the LLM’s evaluation in code.
- The generator and validator are separate prompts, each specialized. This modularity means you could improve the validator (e.g., add more checks) without changing how the answer is generated, or vice versa.
- The loop itself is some vanilla JavaScript. We can impose a safety limit on iterations and decide what to do if the criteria never meet (here we just return the last answer). With llm-exe, you’re free to combine AI calls with such logic – nothing is hidden.

## Why llm-exe for Self-Refinement?

Self-refinement showcases llm-exe’s ability to coordinate multi-part reasoning transparently. In other setups, one might attempt to have the LLM internally critique and fix its answer in a single prompt via few-shot examples or chain-of-thought. That can work for simple cases, but it’s hard to enforce and debug. Using explicit separate executors for generation and validation gives clarity: you know which prompt is responsible for creation and which for checking. If the final output isn’t good, you can see whether the generator is underperforming or the checker is mis-evaluating.

Compared to alternative frameworks, llm-exe doesn’t lock you into a rigid loop or agent pattern – you write the loop yourself, so it’s fully customizable. This means you can insert extra logging, tweak the prompt between attempts, or break out of the loop based on custom heuristics. The control remains in your hands, with the heavy lifting (language generation and analysis) done by the LLM functions.

Lastly, this pattern underscores execution clarity and testability. Each component (answer prompt and check prompt) can be tested in isolation. You could even use the validator LLM executor in other contexts (for example, to evaluate user-submitted content elsewhere). llm-exe’s design makes such reuse straightforward, whereas a monolithic self-refining prompt would be entangled and hard to repurpose. In summary, recursive and iterative refinement flows are elegantly handled by llm-exe by combining straightforward code loops with specialized LLM executors, resulting in robust solutions that gracefully correct themselves.
