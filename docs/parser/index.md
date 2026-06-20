---
title: "Parsers | Validate and Transform LLM Output with llm-exe"
description: "Use parsers in prompt files or TypeScript to turn LLM text into strings, booleans, numbers, JSON, arrays, and schema-validated objects."
---

# Parser

Parsers turn LLM output into data your application can use.

In a prompt file, use `parser` and `parserOptions`.

```yaml
provider: openai.gpt-4o-mini
message: "Extract sentiment from: {{text}}"
parser: json
parserOptions:
  schema:
    type: object
    additionalProperties: false
    properties:
      sentiment:
        type: string
    required: [sentiment]
data:
  text: I love this.
```

Run it:

```bash
llm-exe ./sentiment.yml --json
```

The JSON parser parses the model response and validates it against the schema. For providers that support structured JSON output, llm-exe also sends the schema to the provider.

## Built-In Parsers

The default parser is `string`.

```yaml
provider: openai.gpt-4o-mini
message: "Summarize: {{text}}"
parser: string
```

Other built-in parsers include:

- `json`
- `boolean`
- `number`
- `listToArray`
- `listToJson`
- `listToKeyValue`
- `stringExtract`
- `markdownCodeBlock`
- `markdownCodeBlocks`
- `replaceStringTemplate`

See [Included Parsers](/parser/included-parsers.html).

## Parser Options

Parser options go under `parserOptions`.

```yaml
parser: stringExtract
parserOptions:
  enum:
    - approve
    - reject
```

For JSON-style output, schema options are the most common use.

```yaml
parser: json
parserOptions:
  schema:
    type: object
    properties:
      answer:
        type: string
      confidence:
        type: integer
    required: [answer, confidence]
```

## TypeScript

In TypeScript, use `createParser`.

```ts
import { createParser } from "llm-exe";

const parser = createParser("listToArray");

const parsed = parser.parse(`First step
Second step
Third step`);

console.log(parsed);
// ["First step", "Second step", "Third step"]
```

## JSON Schema Types

Use `defineSchema` when you want TypeScript to infer the parsed output type from a JSON Schema.

```ts
import { createParser, defineSchema } from "llm-exe";

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
```

The same schema can live in a prompt file, but the TypeScript type inference only exists in code.

```yaml
parser: listToJson
parserOptions:
  schema:
    type: object
    properties:
      statement:
        type: string
      answer:
        type: string
      confidence:
        type: integer
    required: [statement, answer, confidence]
```

## Custom Parsers

Custom parsers are JavaScript functions, so they are TypeScript-only.

Use a built-in parser from prompt files. Use [Custom Parsers](/parser/custom.html) when you need full control in code.
