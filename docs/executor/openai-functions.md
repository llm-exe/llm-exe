---
title: "Function Calling and Tool Use in TypeScript | llm-exe"
description: "Add tool calling to LLM apps with createLlmFunctionExecutor. Define tools as JSON Schema and let OpenAI, Anthropic, and other models call them in TypeScript."
---

# Tool Calling Executor

To take advantage of tool calling with OpenAI, Anthropic, and other providers that support it, you can use `createLlmFunctionExecutor` or the `LlmExecutorWithFunctions` class directly. It works exactly like a regular [llm executor](/executor/) — it extends the class and adds options with some additional type constraints.

::: warning Deprecated Export
`LlmExecutorOpenAiFunctions` is deprecated and will be removed in a future major version. Use `LlmExecutorWithFunctions` or `createLlmFunctionExecutor` instead — they support tool calling across all providers, not just OpenAI.
:::

## Basic Example

```ts{13,14,15,16,17,18,19,20,21,26,27}
const llm = useLlm("openai.gpt-4o-mini");
const instruction = `You are walking through a maze.
You must take one step at a time.
Pick a direction to move.`;

const prompt = createChatPrompt(instruction);

// Using the factory function (recommended)
const executor = createLlmFunctionExecutor({
  llm,
  prompt,
})

// Or using the class directly
// const executor = new LlmExecutorWithFunctions({ llm, prompt })

const functions = [{
    name: "move_left",
    description: "move one block to the left",
    parameters: {/* options, as JSON Schema */}
},{
    name: "move_right",
    description: "move one block to the right",
    parameters: {/* options, as JSON Schema */}
}]

const response = await executor.execute({
  input: "Hello!"
}, {
  functionCall: "auto",
  functions: functions,
})
```

## Execute Options

The second argument to `execute()` controls tool calling for that call.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `functions` | `Array<{ name, description, parameters? }>` | `undefined` | The tools the LLM is allowed to call. `parameters` is a JSON Schema object describing the tool's arguments. |
| `functionCall` | `"auto" \| "none" \| "any" \| { name: string }` | `undefined` | How the LLM should choose. `"auto"` lets it decide, `"none"` forbids tool calls, and `"any"` forces it to call some tool — these three work on every provider. `{ name }` (force one specific tool) is currently mapped only for Anthropic (direct and Bedrock; note Bedrock rejects a forced tool_choice combined with adaptive thinking). On Google it falls back to `"auto"`, and on OpenAI-compatible endpoints it is passed through unmapped, which the provider rejects. |
| `functionCallStrictInput` | `boolean` | `false` | Enables strict schema adherence on providers that support it (OpenAI-compatible endpoints). Ignored elsewhere. |
| `jsonSchema` | `Record<string, any>` | `undefined` | Optional JSON Schema for structured output. Mapped for OpenAI-compatible endpoints (OpenAI, xAI, Deepseek) only; silently ignored elsewhere. |

::: tip
Tool definitions are normalized internally, so the same `functions` array works across OpenAI, Anthropic, Google, xAI, and other providers that support tool calling.
:::

## Handling the Response

The tool-calling executor returns one of two things, depending on what the LLM did:

- **The LLM called one or more tools** — you get the normalized content array, `OutputResultContent[]`. Each tool call is an object with `type: "function_use"`, plus `name`, `input`, and `functionId`.
- **The LLM replied with text instead** — you get the output of the parser you passed in (a `string` by default, since the executor falls back to the string parser).

Use the exported `guards.isFunctionCall` type guard to tell them apart without hand-writing checks:

```ts
import { guards } from "llm-exe";

const response = await executor.execute({ input: "What's the weather in Denver?" }, {
  functionCall: "auto",
  functions,
})

if (guards.hasFunctionCall(response)) {
  for (const item of response) {
    if (guards.isFunctionCall(item)) {
      // item.name      -> "getWeather"
      // item.input     -> { latitude: 39.7392, longitude: -104.9903 }
      // item.functionId -> provider-assigned call id, use it when replying
      const result = await callYourTool(item.name, item.input);
    }
  }
} else {
  // plain text response, already run through your parser. hasFunctionCall
  // (not Array.isArray) is the discriminator: a parser like listToArray also
  // returns an array on the text path, and it must land here, not above.
  console.log(response);
}
```

::: warning
A parser passed to `createLlmFunctionExecutor` only applies to the **text** path. When the LLM calls a tool, the raw normalized `function_use` content is returned so you can dispatch on it — the parser is not applied to tool arguments. Validate `item.input` yourself if the tool schema isn't enough.
:::

## Replying With Tool Results

Tool calling is a loop: run the tool, add the result back to the conversation, and call the executor again. `functionId` is what ties a result back to the call that produced it — see [Dialogue](/state/dialogue) for storing the running history, and [`addFromHistory`](/prompt/chat) for replaying it into the next prompt.

## See Also

- [Executor overview](/executor/) — the standard LLM executor and how types flow through it
- [Callable executors](/callable/) — expose other executors as tools the LLM can call
- [Parsers](/parser/) — parsing the text path of the response
