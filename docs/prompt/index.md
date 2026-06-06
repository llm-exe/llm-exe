---
title: Prompts | Dynamic, Typed Prompt Templates in llm-exe
description: "Design powerful prompts with Handlebars templates, full type safety, and reusable partials. llm-exe lets you separate logic from content—so your LLM apps stay readable, testable, and maintainable."
---

# Prompt

The prompt is the instruction for the LLM, usually sent in plain-text or an array of chat-style messages. When working with certain models, the prompt is formatted like chat messages, allowing you to control a system message, user message, and assistant message.

llm-exe provides a prompt interface to simplify working with prompts. Ultimately a prompt is a string, but building elaborate prompts can quickly get complicated. The prompt utility provides a foundation for building complex prompts.

- Support for text-based or chat-based prompts.
- Uses Handlebars as template engine, allowing you to use features such as custom templates, partials, functions, etc. See [handlebars documentation](https://handlebarsjs.com/guide/) for everything you can do.
- Infers types when they are provided.

Note: You can use and call methods on prompts directly, but they are usually passed to an LLM executor and then called internally.

There are 2 types of prompts included, along with a `BasePrompt` class that can be extended, if needed.

See:

- [Text Prompt](/prompt/text.html)
- [Chat Prompt](/prompt/chat.html)
- [Prompt Validation](/prompt/validation.html)

## Basic Replacements

The object that you pass to `prompt.format` (or `.execute` when a prompt is part of an LLM executor) gets passed to the template engine, making all those variables available to you in your prompt template.

<GenericOutput example="prompt.basic.exampleOne">

<<< ../../examples/prompt/basic.ts#exampleOne
</GenericOutput>

For advanced uses and working with custom helpers/partials, [see here](/prompt/advanced.html).

## Validating Template Inputs

Prompts can validate that required template variables and helpers are available before rendering. Use `prompt.validate(input)` directly, or set `validateInput: "strict"` / `"warn"` on a prompt to check calls to `format()`.

See [Prompt Validation](/prompt/validation.html).

## Using Types with Prompts

<GenericOutput example="prompt.basic.exampleTwo">

<<< ../../examples/prompt/basic.ts#exampleTwo
</GenericOutput>
