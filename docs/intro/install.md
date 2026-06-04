# Install

Install llm-exe using npm.
```txt
npm i llm-exe
```

```ts
import * as llmExe from "llm-exe"

// or 

import { /* specific modules */ } from "llm-exe"
```

## Basic Example
Below is a simple example:
```ts
import {
  useLlm,
  createChatPrompt,
  createLlmExecutor
} from "llm-exe";

const llm = useLlm("openai.gpt-4o-mini");

// The first argument is the system message.
// Add a user message that references your input variable.
const prompt = createChatPrompt<{ input: string }>("Talk like a pirate.")
  .addUserMessage("{{input}}");

const executor = createLlmExecutor({
  llm,
  prompt,
});

const response = await executor.execute({ input: "Hello!" });
/**
 *
 * The prompt sent to the LLM would be:
 *
 * [
 *   { role: 'system', content: 'Talk like a pirate.' },
 *   { role: 'user',   content: 'Hello!' }
 * ]
 *
 */

/**
 *
 * Output from LLM executor:
 * Arrr, matey! Speak up, fer me ears be as keen as a sea serpent's!
 * Avast ye, what be your query?
 */
```

::: tip
Passing a value as `{ input }` does **not** automatically append a user message — your prompt must reference it (for example with `{{input}}` in a template or by calling `.addUserMessage("{{input}}")`). The chat prompt always renders exactly the messages you build.
:::