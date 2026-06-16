# Prompts with Templates

Handlebars is used as a template engine when generating the prompt, so you can take advantage of advanced template features in the prompt. See full capabilities [here](https://handlebarsjs.com/guide/).

Below is a simple example showing syntax for replacing simple variables in the template.

<GenericOutput example="prompt.advanced.withReplacements">

<<< ../../examples/prompt/advanced.ts#withReplacements
</GenericOutput>

Here is a more advanced example showing a template that uses the `if` and `each` helpers supplied by Handlebars.
<GenericOutput example="prompt.advanced.withReplacementsTwo">

<<< ../../examples/prompt/advanced.ts#withReplacementsTwo
</GenericOutput>

Below is a robust example showing multiple variables, and defining types.

<GenericOutput example="prompt.advanced.withReplacementsAndTypes">

<<< ../../examples/prompt/advanced.ts#withReplacementsAndTypes
</GenericOutput>

## Prompt Template Default Helpers

Prompts are powered by handlebars, and you are able to register your own custom helpers, adding super powers to your prompt templates. Some core helpers are included by default.

- pluralize
- eq
- neq
- ifCond

## Prompt Template Default Partials

Some core partials are included by default:

### MarkdownCode

::: code-group

```[Template]
{{> MarkdownCode code='const name="Greg";' language='typescript' }}
```

```[Parsed]
'''typescript
const name="Greg";
'''
```

:::

### DialogueHistory

::: code-group

```txt [Raw Template]
// Basic example
{{> DialogueHistory key='keyOfTheChatHistory' }}

//  With title
{{> DialogueHistory title='The conversation is below:' key='keyOfTheChatHistory' }}

// Setting user name
{{> DialogueHistory key='keyOfTheChatHistory' user='Greg' }}

// Setting user and assistant - be creative!
{{> DialogueHistory key='keyOfTheChatHistory' assistant='Thought' user='Observation' }}


// Assuming you passed the following:
{
  keyOfTheChatHistory: [{
    role: "user",
    content: "Hello?",
  },{
    role: "assistant",
    content: "Hi! How can I help you?",
  },{
    role: "user",
    content: "I was wondering if you were open",
  },{
    role: "assistant",
    content: "We sure are!",
  }]
}
```

```txt [Parsed]
// Basic example
User: Hello?
Assistant: Hi! How can I help you?
User: I was wondering if you were open
Assistant: We sure are!

//  With title
The conversation is below:
User: Hello?
Assistant: Hi! How can I help you?
User: I was wondering if you were open
Assistant: We sure are!

// Setting user name
Greg: Hello?
Assistant: Hi! How can I help you?
Greg: I was wondering if you were open
Assistant: We sure are!

// Setting user and assistant - be creative!
Thought: Hello?
Observation: Hi! How can I help you?
Thought: I was wondering if you were open
Observation: We sure are!

```

:::

<!-- ### JsonSchema
```:no-line-numbers
```
### JsonSchemaExampleJson
```:no-line-numbers
``` -->

## Template Custom Partials & Helpers

You can load custom Handlebars partials and helpers a few different ways:

### 1. Pass them in when initializing the prompt

```ts
// these could be managed elsewhere and imported here
const helpers = [
  {
    handler: (date: Date) => "morning",
    name: "getTimeOfDay",
  },
];

const partials = [
  {
    template: `Phone: 1-800-000-0000
Support Email: support@example.com
Website: www.example.com`,
    name: "partialContactInformation",
  },
];

// pass in `{ helpers, partials }` when creating prompt.
const prompt = createPrompt("text", "You are a cowboy.", { helpers, partials });
```

### 2. Register them globally

If you want helpers or partials available to all prompts in your application, use the standalone `registerHelpers` and `registerPartials` utility functions. These register with the global Handlebars instance, so any prompt created afterward can use them.

```ts
import { registerHelpers, registerPartials } from "llm-exe";

// Register custom helpers globally
registerHelpers([
  {
    name: "uppercase",
    handler: (str: string) => str.toUpperCase(),
  },
]);

// Register custom partials globally
registerPartials([
  {
    name: "greeting",
    template: "Hello {{name}}!",
  },
]);

// Now any prompt can use them
const prompt = createChatPrompt("{{> greeting name='World'}} {{uppercase 'hello'}}");
```
