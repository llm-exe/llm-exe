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
- Set defaults on individual properties, which the parser applies when a value is missing.

## Reusing the schema at parse time

The same JSON Schema you put in the prompt can be handed to the [`json` parser](/parser/included-parsers.html#json) so the response is validated and typed at runtime. Wrap it in [`defineSchema`](/parser/index.html#defineschema) to keep full TypeScript inference:

```ts
import { defineSchema, createParser } from "llm-exe";

const schema = defineSchema({
  type: "object",
  properties: {
    thought: { type: "string" },
    direction: { type: "string", enum: ["forward", "back", "left", "right"] },
  },
  required: ["thought", "direction"],
  additionalProperties: false,
});

const parser = createParser("json", { schema });

const parsed = parser.parse(llmResponse);
// parsed is typed as { thought: string; direction: "forward" | "back" | "left" | "right" }
```

### What the parser does at runtime

Providing a `schema` turns on validation **by default** (`validateSchema` defaults to `true` when a schema is set):

- **`required` is enforced.** If the LLM omits a required field, the parser throws `parser.schema_validation_failed` rather than returning a partial object. This prevents incomplete LLM output from silently passing through as valid, typed data.
- **Defaults are applied _after_ validation.** A `default` on a property does **not** satisfy a `required` constraint — the field must be present in the response.
- **Unknown keys are stripped** and remaining values are coerced to the schema's types.

If you intentionally want the legacy "strip unknown keys and apply defaults, but do not check `required`" behavior, opt out explicitly:

```ts
const parser = createParser("json", { schema, validateSchema: false });
```

::: warning
With `validateSchema: false`, a response missing a `required` field is **not** flagged — it passes through as a partial object. Only disable validation when you deliberately want that behavior.
:::
