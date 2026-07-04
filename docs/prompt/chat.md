---
title: "Build Chat Prompts with System and User Messages | llm-exe"
description: "Create chat-style prompts with system, user, and assistant messages in TypeScript. Works with chat models from OpenAI, Anthropic, Google, and more."
---

# Chat Prompt

The other type of prompt is a chat prompt. The chat prompt can be used with chat-based models from any supported provider (OpenAI, Anthropic, Google, etc.).

You create a chat prompt using `createPrompt("chat")` or `createChatPrompt()`.

<GenericOutput example="prompt.chat.exampleCreateChatPrompt">

<<< ../../examples/prompt/chat.ts#exampleCreateChatPrompt
</GenericOutput>

When creating a chat prompt, you can optionally set an initial system message.

<GenericOutput example="prompt.chat.exampleCreateChatPromptWithSystem">

<<< ../../examples/prompt/chat.ts#exampleCreateChatPromptWithSystem
</GenericOutput>

To use the prompt as input to an LLM, you can call the `format()` method on the prompt. The format method accepts an object, which is used to supply the prompt template with replacement values.

<GenericOutput example="prompt.chat.exampleCreateChatPromptUseFormat">

<<< ../../examples/prompt/chat.ts#exampleCreateChatPromptUseFormat
</GenericOutput>

Chat prompts support more than just a basic text-based message. You can also add assistant and user content.

<GenericOutput example="prompt.chat.exampleCreateChatPromptWithAssistant">

<<< ../../examples/prompt/chat.ts#exampleCreateChatPromptWithAssistant
</GenericOutput>

See [prompt templates](/prompt/advanced) for more advanced prompt usage.

## Chat Prompt Methods

`addUserMessage`
Appends a user message to the prompt.

`addAssistantMessage`
Appends an assistant message to the prompt.

`addSystemMessage`
Appends a system message to the prompt.

`addFromHistory`
Appends an array of existing chat history messages to the prompt.

`format`
Format the prompt for LLM. This processes the template as a handlebars template.

<!-- `validate`
Validate the prompt. Makes sure there are no unresolved tokens. -->
