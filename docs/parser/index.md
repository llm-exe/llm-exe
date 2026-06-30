---
title: "Parsers | Validate and Transform LLM Output with llm-exe"
description: "Parsers turn raw LLM output into structured, reliable data. Choose from built-in options or define custom parsers to enforce schemas, extract values, and shape responses for safe, predictable AI execution."
---

# Parser

When calling LLM's the response is ultimately a string. While you can (and will) instruct the LLM to respond with a number, or formatted as JSON... the response will still be a string.

Parsers are used to take the output from the LLM, and format it into a data type that is usable by your application.

There are various default parsers included, and the parser class is easily extendable.

When combined with an LLM executor, the parser is responsible for providing type hints to the Typescript compiler on the expected output for the LLM executor.

**Note**: You can use and call methods on parsers directly, but they are usually passed to an [LLM executor](/executor/index.html) and then called internally.

## Getting Started

### Working with Parsers

When working with output parsers, you have two options:

1. Use a [default parser](/parser/included-parsers.html).
2. Create a [custom parser](/parser/custom.html) for full control over output transformation.

#### Use a Default Parser

```ts
const parser = createParser("listToArray"); // see list of included parsers

// example output string from LLM
const exampleOutputFromLlm = `First, hover the services menu
Wait for the dropdown menu to appear
Click on the development link`;

// listToArray will split a string on line breaks
const parsed = parser.parse(exampleOutputFromLlm);

/**
 *
 * console.log(parsed);
 *
 * [
 *   "First, hover the services menu",
 *   "Wait for the dropdown menu to appear",
 *   "Click on the development link"
 * ]
 *
 */
```

#### Using a Parser with Schema

When instructing the LLM to respond with json or a format that can be parsed to json, it can be helpful to define schema. This allows you to validate, provide default values, and have a fully-typed response. In fact, the JSON Schema you define can be really useful (and re-used!) in your prompt. [See tips](/examples/concepts/working-with-json) for working with JSON.

##### `defineSchema`

The `defineSchema` helper narrows a JSON Schema definition to its literal type so TypeScript can infer the exact shape of the parsed output. It also sets `additionalProperties: false` to ensure strict validation. Use it whenever you define schemas for JSON parsers.

```ts
import { defineSchema, createParser } from "llm-exe";

const schema = defineSchema({
  type: "object",
  properties: {
    statement: { type: "string", default: "" },
    answer: { type: "string", default: "" },
    confidence: { type: "integer", default: 0 },
  },
  required: ["statement", "answer", "confidence"],
});

const parser = createParser("listToJson", { schema });

const exampleOutputFromLlm = `Statement: The included document contains PII\nAnswer: No\nConfidence: 90`;

const parsed = parser.parse(exampleOutputFromLlm);
/**
 *
 * console.log(parsed);
 *
 * {
 *   "statement": "The included document contains PII",
 *   "answer": "No",
 *   "confidence": 90
 * }
 *
 */
```

::: warning Schema validation is on by default
When you provide a `schema`, the parser enforces it on the LLM's output by default (`validateSchema` defaults to `true`). Missing `required` fields or constraint violations throw `parser.schema_validation_failed` instead of returning a partial object, and defaults are applied **after** validation. Pass `validateSchema: false` to opt into filter/default-only behavior. See the [JSON parser reference](/parser/included-parsers.html#json) for details.
:::
