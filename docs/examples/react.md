---
title: "Build a ReAct Agent in TypeScript | llm-exe"
description: "Build a ReAct agent in TypeScript: an LLM loop that reasons step by step, calls tools like search and a calculator, and iterates to a final answer."
---

## ReAct with Actions (tools)

In this example, we will create a series of LLM executor functions which will work together to think step-by-step to decide which action to take to ultimately come up with the correct answer to an input question. The functions will use an internal dialogue combined with gtp-3.5-turbo.

Steps Overview
- **Define actions**. llm-exe does not provide pre-built tools or actions, but does provide a way to make any regular javascript function callable. For this example, we will need the ability to perform a Google search via an api, and also a function that calculates basic expressions.
- **Create LLM Executor**. Configure a prompt and LLM executor that is directed to think step by step through the question to decide the next action to take. We direct the LLM to respond with a thought/action/input and use an output parser to transform to JSON.
- **Write a loop** that will call our LLM executor to decide the next action and pass the result to another function to run the action. This continues until the final answer is reached (or max iterations is hit).

Note this is a basic example, and should be improved for error handling, etc.

#### Step 1 - Define Search Action
To allow our LLM to be able to search the internet, we'll need to define a callable function. You can use whatever search API configuration you'd like.

Note that `searchInternetCallable` is the configuration object that makes `searchGoogleApi` callable. Nothing really fancy going on.

<<< ../../examples/actions/search.ts

#### Step 2 - Define Calculator Action
To allow our LLM to be able to perform advanced calculations, we'll need to define a callable function. You can use whatever calculation library you'd like.

<<< ../../examples/actions/calculator.ts

#### Step 3 - Define Final Answer Action
We need to define a final answer action, but in this example we won't be doing anything with it, so we'll just pass through the input.

<<< ../../examples/actions/finalAnswer.ts


#### Step 4 - Configure Thought/Action/Input LLM executor
Configure a prompt and LLM executor that is directed to think step by step through the question to decide the next action to take.
@[code{15-67} ts](../../examples/_testing/react.ts)


#### Step 5 - Write Some Code
We'll write a simple loop that brings the previous steps together.
@[code{70-200} ts](../../examples/_testing/react.ts)


#### Example Output
```typescript
import { useSearchAndCalculatorReact } from "previous-example"


const input = `How much money did Roope Hintz make in 2023? What is that number multiplied by 12.25?`;

const { result } = await useSearchAndCalculatorReact(input);

/**
 * console.log(result)
 * 
 * "Roope Hintz made $11,500,000 in 2023. Multiplying this by 12.25
 * gives us a total of $140,875,000."
 * 
 */

```

Let's see how it got there:


First Iteration: 
::: code-group

```text [Result]
# LLM Output: 
{
  action: 'search_internet',
  input: '"Roope Hintz salary 2023"',
  thought: 'We need to find out how much money Roope Hintz made in 2023 before we can multiply it by 754. We can use a search engine to find this information.'
}

# Action Output: 
Dallas Stars Roope Hintz's salary is $11,500,000 and his cap hit is $8,450,000 for the 2023-24 season. His salary is comprised of $4,000,000 in signing bonuses and $7,500,000 in base salary. He is a 26 year old centre who was born on Nov. 17, 1996.
```

```text [Prompt]
    [{
      role: 'system',
      content: 'We need to think step by step on how to answer the question outlined below.\n' +
        '\n' +
        'Based on the actions listed below, decide the next step to take to help provide a final answer.\n' +
        '\n' +
        '# Actions\n' +
        'Action: search_internet (a search engine. useful for when you need to answer questions about current events. input should be a search query.)\n' +
        'Action Input: A string, a simple explanation of what you need. This is like a google search.\n' +
        '\n' +
        'Action: calculator (When you need to perform math)\n' +
        'Action Input: Must be a valid mathematical expression that could be executed by a simple calculator.\n' +
        '\n' +
        'Action: final_answer (When you know the final answer to the question)\n' +
        'Action Input: A string, the final answer and brief summary of how you came to that conclusion.'
    },
    {
      role: 'user',
      content: 'Below is a full conversation.\n' +
        '\n' +
        '\n' +
        'Most Recent Message: How much money did Roope Hintz make in 2023? What is that number multiplied by 12.25?\n' +
        '---\n' +
        '\n' +
        'What is the next action I should take to come up with a valid response?'
    },
    {
      role: 'system',
      content: 'Think step by step. If you are able to provide a final answer, use the final_answer action. What is the next action? Reply with:\n' +
        'Thought: <explain why you think this is the next action>\n' +
        'Action: <The action_key. Must be one of: search_internet, calculator, final_answer>\n' +
        'Input: <The input for the action. Reference the action input from the list above, and provide valid input for the action>'
    }]
```

:::

Second Iteration: 
::: code-group
```text [Result]
# LLM Output: 
{
  action: 'calculator',
  input: '11500000',
  thought: 'We need to calculate how much money Roope Hintz made in 2023 before we can multiply it by 75
}

# Action Output: 11500000
```

```text [Prompt]
[
    {
      role: 'system',
      content: 'We need to think step by step on how to answer the question outlined below.\n' +
        '\n' +
        'Based on the actions listed below, decide the next step to take to help provide a final answer.\n' +
        '\n' +
        '# Actions\n' +
        'Action: search_internet (a search engine. useful for when you need to answer questions about current events. input should be a search query.)\n' +
        'Action Input: A string, a simple explanation of what you need. This is like a google search.\n' +
        '\n' +
        'Action: calculator (When you need to perform math)\n' +
        'Action Input: Must be a valid mathematical expression that could be executed by a simple calculator.\n' +
        '\n' +
        'Action: final_answer (When you know the final answer to the question)\n' +
        'Action Input: A string, the final answer and brief summary of how you came to that conclusion.'
    },
    {
      role: 'user',
      content: 'Below is a full conversation.\n' +
        '\n' +
        '\n' +
        'Most Recent Message: How much money did Roope Hintz make in 2023? multiply it by 754.\n' +
        '---\n' +
        '\n' +
        'What is the next action I should take to come up with a valid response?'
    },
    {
      role: 'assistant',
      content: 'We need to find out how much money Roope Hintz made in 2023 before we can multiply it by 754. We can use a search engine to find this information.'
    },
    {
      role: 'user',
      content: "Dallas Stars Roope Hintz's salary is $11,500,000 and his cap hit is $8,450,000 for the 2023-24 season. His salary is comprised of $4,000,000 in signing bonuses and $7,500,000 in base salary. He is a 26 year old centre who was born on Nov. 17, 1996."
    },
    {
      role: 'system',
      content: 'Think step by step. If you are able to provide a final answer, use the final_answer action. What is the next action? Reply with:\n' +
        'Thought: <explain why you think this is the next action>\n' +
        'Action: <The action_key. Must be one of: search_internet, calculator, final_answer>\n' +
        'Input: <The input for the action. Reference the action input from the list above, and provide valid input for the action>'
    }
  ]
```

:::


Third Iteration: 
::: code-group

```text [Result]
# LLM Output: 
{
  action: 'calculator',
  input: '11500000 * 754',
  thought: 'We need to multiply the salary of Roope Hintz in 2023 by 754 to get the answer to the question.'
}

# Action Output: 8671000000
```

```text [Prompt]
  [
    {
      role: 'system',
      content: 'We need to think step by step on how to answer the question outlined below.\n' +
        '\n' +
        'Based on the actions listed below, decide the next step to take to help provide a final answer.\n' +
        '\n' +
        '# Actions\n' +
        'Action: search_internet (a search engine. useful for when you need to answer questions about current events. input should be a search query.)\n' +
        'Action Input: A string, a simple explanation of what you need. This is like a google search.\n' +
        '\n' +
        'Action: calculator (When you need to perform math)\n' +
        'Action Input: Must be a valid mathematical expression that could be executed by a simple calculator.\n' +
        '\n' +
        'Action: final_answer (When you know the final answer to the question)\n' +
        'Action Input: A string, the final answer and brief summary of how you came to that conclusion.'
    },
    {
      role: 'user',
      content: 'Below is a full conversation.\n' +
        '\n' +
        '\n' +
        'Most Recent Message: How much money did Roope Hintz make in 2023? multiply it by 754.\n' +
        '---\n' +
        '\n' +
        'What is the next action I should take to come up with a valid response?'
    },
    {
      role: 'assistant',
      content: 'We need to find out how much money Roope Hintz made in 2023 before we can multiply it by 754. We can use a search engine to find this information.'
    },
    {
      role: 'user',
      content: "Dallas Stars Roope Hintz's salary is $11,500,000 and his cap hit is $8,450,000 for the 2023-24 season. His salary is comprised of $4,000,000 in signing bonuses and $7,500,000 in base salary. He is a 26 year old centre who was born on Nov. 17, 1996."
    },
    {
      role: 'assistant',
      content: 'We need to calculate how much money Roope Hintz made in 2023 before we can multiply it by 754.'
    },
    { role: 'user', content: '11500000' },
    {
      role: 'system',
      content: 'Think step by step. If you are able to provide a final answer, use the final_answer action. What is the next action? Reply with:\n' +
        'Thought: <explain why you think this is the next action>\n' +
        'Action: <The action_key. Must be one of: search_internet, calculator, final_answer>\n' +
        'Input: <The input for the action. Reference the action input from the list above, and provide valid input for the action>'
    }
  ]
```
:::

Fourth Iteration: 
::: code-group

```text [Result]
# LLM Output: 
{
  action: 'final_answer',
  input: 'Roope Hintz made $8,671,000,000 in 2023. This was calculated by multiplying his salary of $11,500,000 by 754.',
  thought: 'We have the final answer to the question. We can use the final_answer action to provide the answer.'
}

# Action Output: 
Roope Hintz made $8,671,000,000 in 2023. This was calculated by multiplying his salary of $11,500,000 by 754.
```
:::