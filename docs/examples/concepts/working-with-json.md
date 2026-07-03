---
title: "Get Reliable JSON from LLM Responses | llm-exe"
description: "Tips for getting reliable JSON from LLMs in TypeScript, including using JSON Schema in your prompt to specify types, required fields, enums, and defaults."
---

# Tips: Working with JSON

Instructing an LLM to work with JSON can be difficult.  Below are some tricks to working with JSON.

Use JSON Schema in your instructions
One useful is taking advantage of JSON Schema structure for explaining details about the expected response. Not only can you use the schema to tell the LLM which properties you want back, you can utilize properties such as 'required' 'name', description', and other properties to provide structured instructions.

Take the following example:

Here is a prompt which is attempting to tell the LLM which properties it expects, with some additional info.


The following example demonstrates how you could attempt to instruct the LLM to respond with a particular JSON format.

```
...rest of prompt

I need you to reply with valid JSON containing the following properties:

thought: this is where you explain your thoughts. This is required.
direction: the direction you chose to move. Muse be one of: forward, back, left, right. This is required.

For Example:
{
    "thought":  "explanation of your thoughts",
    "direction": "the direction you chose to move"
}
```


Here we can provide the same information, but this time using JSON Schema within our instruction. 

```
...rest of prompt

Your response must EXACTLY follow the JSON Schema specified below:
{
    type: "object",
    properties: {
      thought: {
        type: "string",
        description: "explanation of your thoughts" 
        },
      direction: {
        type: "string",
        description: "the direction you chose to move",
        enum: ["forward", "back", "left", "right"] 
      },
    },
    required: ["thought", "direction"],
    additionalProperties: false,
}

For Example:
{
    "thought":  "explanation of your thoughts",
    "direction": "the direction you chose to move"
}
```

Now, we have instructed the LLM without directly telling it that:
- We expect the response to be an object (we could use type: array syntax if we wanted!)
- We were able to hint at the data type.
- We were able to provide a well-marked description
- We were able to provide the options when there are specific choices
- We were able to tell it which fields were required without repeating ourselves over an over (which could stray the prompt)
- We are able to hint that we don't want additional properties.

You can also:
- Set defaults

### Related

- [Write a Type-Safe LLM Function](/examples/concepts/type-safe-llm-function.html) — schema-driven prompt, validation, and return type in one
- [Extract Structured Data](/examples/bots/extract.html) — caller-supplied schemas for slot filling
- [Included Parsers](/parser/included-parsers.html) — the JSON parser reference
