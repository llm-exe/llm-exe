---
title: "Migrating from llm-exe 2.x to 3.x"
description: "Migration guide for parser and output-boundary changes when upgrading llm-exe from 2.x to 3.x."
---

# Migrating from llm-exe 2.x to 3.x

Status: draft
Milestone: v3.0.0

This guide covers the v3 behavior changes that may require application updates.

## v3 Overview

v3 is stricter about parser output, prompt input, execution metadata, and provider errors.

The main changes are:

- Parsers throw when they cannot parse the requested output.
- The JSON parser validates against the provided schema by default.
- llm-exe errors use `LlmExeError` with `code`, `category`, `context`, and `cause`.
- Provider HTTP failures map to llm-exe error codes.
- Prompts can check template variables and helpers before rendering.
- Custom parser callbacks receive `ExecutionContext`.
- Deprecated provider/model shorthands still work, but emit process warnings.

Most migrations are small code updates: handle parser errors instead of fallback values, call `prompt.validate(input)` with input, read parser context from `context.execution`, and branch on `LlmExeError` codes when needed.

The benefit is a clearer contract between your code and the model. Prompt inputs are checked earlier, parser output is enforced more consistently, provider failures carry structured error data, and execution metadata is easier to pass through logs, hooks, and custom parsers.

## Parser Failures No Longer Return Fallback Values

In 2.x, several parsers could return valid-looking fallback values when parsing failed. In 3.x, parser failure is explicit.

Examples:

```ts
createParser("json").parse("not json");
// 2.x: {}
// 3.x: throws LlmExeError with code "parser.parse_failed"

createParser("boolean").parse("maybe");
// 2.x: false
// 3.x: throws LlmExeError with code "parser.parse_failed"
```

Migration:

- Treat parser failures as errors, not empty values.
- Catch `LlmExeError` parser codes where retry, repair, or fallback behavior is intentional.
- Do not rely on `{}`, `false`, `""`, or `[]` as parse-failure sentinels.

## Parser Error Codes

Parser failures use a smaller, typed error-code surface:

- `parser.parse_failed`
- `parser.schema_validation_failed`

Parser-specific detail is available in `error.context.reason`.

Migration:

```ts
try {
  const result = parser.parse(output);
} catch (error) {
  if (isLlmExeError(error, "parser.schema_validation_failed")) {
    // Handle schema mismatch.
  }

  if (isLlmExeError(error, "parser.parse_failed")) {
    // Handle malformed or unrecognized parser input.
  }
}
```

Parser errors do not include raw model/user output by default. Use metadata such as `inputLength`, `expected`, `received`, `reason`, and `schemaErrors`. Debug excerpts are available only behind debug behavior such as `LLM_EXE_DEBUG`.

## Error Handling

v3 uses `LlmExeError` for llm-exe errors. These errors expose:

- `code`
- `category`
- `context`
- `cause`

Migration:

```ts
import { isLlmExeError } from "llm-exe";

try {
  await executor.execute(input);
} catch (error) {
  if (isLlmExeError(error, "llm.provider_rate_limited")) {
    // Queue, retry later, or fall back.
  }

  if (isLlmExeError(error)) {
    logger.error(error.toJSON());
  }
}
```

Provider HTTP failures use codes such as `llm.provider_rate_limited`, `llm.provider_auth_failed`, `llm.provider_invalid_request`, `llm.provider_unavailable`, and `llm.provider_http_error`.

See [Error Handling](/misc/errors).

## JSON Parser Is Strict

`createParser("json")` now parses exact JSON object or array responses by default.

Accepted:

```ts
createParser("json").parse('{"name":"Greg"}');
createParser("json").parse('[{"name":"Greg"}]');
createParser("json").parse("```json\n{\"name\":\"Greg\"}\n```");
```

Rejected:

```ts
createParser("json").parse("");
createParser("json").parse("not json");
createParser("json").parse('"hello"');
createParser("json").parse("123");
createParser("json").parse("true");
createParser("json").parse("null");
createParser("json").parse("Here is JSON:\n```json\n{\"name\":\"Greg\"}\n```");
```

Migration:

- Use `string`, `number`, or `boolean` parsers for primitive outputs.
- Ask the model for a JSON object or array when using the JSON parser.
- If the model returns prose around JSON, change the prompt or set `match: "extract"`.

```ts
createParser("json", { match: "extract" }).parse(
  "Here is JSON:\n```json\n{\"name\":\"Greg\"}\n```"
);
// 3.x: { name: "Greg" }
```

## JSON Schema Validation Defaults to On

When a schema is supplied to `json`, schema validation runs by default.

```ts
const parser = createParser("json", { schema });
```

In 2.x, schema behavior could act like filtering/defaulting without rejecting missing required fields unless validation was explicitly enabled. In 3.x, invalid schema output throws `parser.schema_validation_failed`.

```ts
const schema = defineSchema({
  type: "object",
  properties: {
    name: { type: "string", default: "unknown" },
  },
  required: ["name"],
  additionalProperties: false,
});

createParser("json", { schema }).parse("{}");
// 3.x: throws parser.schema_validation_failed
```

Defaults are applied after validation. Defaults do not satisfy `required`.

Migration:

- Make required fields appear in model output.
- Use defaults for optional fields, not as a substitute for required model output.
- Use `validateSchema: false` only as a compatibility escape hatch for old filter/default-only behavior.

```ts
createParser("json", {
  schema,
  validateSchema: false,
});
```

## JSON Parser Does Not Coerce Schema Values

The strict JSON parser validates parsed JSON as JSON. It does not coerce strings into schema types.

```ts
const schema = defineSchema({
  type: "object",
  properties: {
    count: { type: "number" },
    active: { type: "boolean" },
  },
  required: ["count", "active"],
});

createParser("json", { schema }).parse(
  JSON.stringify({ count: "42", active: "false" })
);
// 3.x: throws parser.schema_validation_failed
```

Migration:

- Prompt for real JSON numbers and booleans: `{ "count": 42, "active": false }`.
- Use `listToJson` when converting line-oriented text where values naturally start as strings.

## listToJson Is a Converter

`listToJson` keeps its line-oriented conversion role. When a schema is supplied, it performs schema-guided scalar coercion before validation because list values are parsed from text.

```ts
const parser = createParser("listToJson", {
  schema: defineSchema({
    type: "object",
    properties: {
      age: { type: "number" },
      active: { type: "boolean" },
    },
    required: ["age", "active"],
  }),
});

parser.parse("Age: 42\nActive: false");
// 3.x: { age: 42, active: false }
```

Invalid coercion candidates still fail validation.

```ts
parser.parse("Age: hello\nActive: maybe");
// 3.x: throws parser.schema_validation_failed
```

Defaults are applied after validation, so defaults do not satisfy required fields.

Migration:

- Use `listToJson` for simple key/value text conversion.
- Keep `json` for strict JSON object/array parsing.
- Use `validateSchema: false` only when preserving old filter/default-only behavior is intentional.

## Boolean Parser Is Exact by Default

The boolean parser accepts only documented boolean literals after trimming and lowercasing:

- truthy: `true`, `yes`, `y`, `1`
- falsy: `false`, `no`, `n`, `0`

By default, it does not extract booleans from prose.

```ts
createParser("boolean").parse("false");
// 3.x: false

createParser("boolean").parse("The answer is true.");
// 3.x: throws parser.parse_failed
```

Migration:

- Prompt for only the boolean token.
- Use `match: "extract"` when the model may return prose.

```ts
createParser("boolean", { match: "extract" }).parse("The answer is true.");
// 3.x: true
```

## stringExtract Defaults Changed

`stringExtract` is now word-boundary based by default and case-insensitive by default.

```ts
createParser("stringExtract", { enum: ["yes"] }).parse("ayesha");
// 3.x: throws parser.parse_failed

createParser("stringExtract", {
  enum: ["yes"],
  match: "word",
}).parse("yes please");
// 3.x: "yes"

createParser("stringExtract", {
  enum: ["yes"],
  match: "substring",
}).parse("ayesha");
// 3.x: "yes"
```

Migration:

- Use the default `word` matching for enum extraction from prose.
- Set `match: "substring"` when preserving legacy contains behavior.
- Set `match: "exact"` when surrounding text should fail.
- Set `ignoreCase: false` when case-sensitive matching is required.

## Number Parser Rejects Ambiguous or Invalid Numeric Text

The number parser extracts exactly one recognized numeric token by default.

```ts
createParser("number").parse("The answer is 42.");
// 3.x: 42

createParser("number").parse("from 1 to 10");
// 3.x: throws parser.parse_failed

createParser("number").parse("1,00,000");
// 3.x: throws parser.parse_failed
```

Use `match: "exact"` to require the entire input to be a numeric token.

```ts
createParser("number", { match: "exact" }).parse("5 dollars");
// 3.x: throws parser.parse_failed
```

Migration:

- Use default extraction for one-number prose.
- Use `match: "exact"` when surrounding text should fail.
- Clean or normalize non-US comma grouping before parsing if needed.

## Markdown Code Block Parsers Are Explicit

`markdownCodeBlock` expects exactly one complete fenced code block.

```ts
createParser("markdownCodeBlock").parse("nothing here");
// 3.x: throws parser.parse_failed

createParser("markdownCodeBlock").parse("```ts\nx\n```\n```js\ny\n```");
// 3.x: throws parser.parse_failed
```

`markdownCodeBlocks` is the plural collector and may return an empty array when no complete code blocks exist.

```ts
createParser("markdownCodeBlocks").parse("nothing here");
// 3.x: []
```

Migration:

- Use `markdownCodeBlock` when exactly one block is required.
- Use `markdownCodeBlocks` when collecting zero or more blocks is valid.

## List Parsers Have Clearer Failure Boundaries

List parsers reject invalid runtime input, empty input where applicable, malformed key/value lines, and mixed marked/unmarked list lines.

`listToJson` duplicate keys throw because object output would overwrite data.

```ts
createParser("listToJson").parse("Name: Greg\nName: Bob");
// 3.x: throws parser.parse_failed
```

`listToKeyValue` preserves duplicate keys because it returns an ordered array.

```ts
createParser("listToKeyValue").parse("Name: Greg\nName: Bob");
// 3.x: [
//   { key: "Name", value: "Greg" },
//   { key: "Name", value: "Bob" },
// ]
```

Migration:

- Use `listToJson` when keys must be unique.
- Use `listToKeyValue` when duplicate keys are meaningful.
- Make list prompts consistently marked or consistently unmarked.

## Prompt validate() Checks Template Input

In 2.x, `prompt.validate()` could be used as a prompt-existence check. In 3.x, `validate(input)` checks prompt template variables and helpers.

```ts
const prompt = createChatPrompt<{ name: string }>("Hello {{name}}");

prompt.validate({ name: "Greg" });
// ok

prompt.validate({});
// throws LlmExeError with code "prompt.missing_template_variable"
```

Migration:

- Replace `prompt.validate()` existence checks with `prompt.messages.length > 0`.
- Pass the same input object you would pass to `format()` or `executor.execute()` when calling `prompt.validate(input)`.
- Catch `prompt.missing_template_variable` when missing prompt input should be handled programmatically.

```ts
const hasPromptContent = prompt.messages.length > 0;
```

Prompts can also validate before rendering:

```ts
const prompt = createChatPrompt<{ name: string }>("Hello {{name}}", {
  validateInput: "strict",
});

prompt.format({});
// throws prompt.missing_template_variable before rendering
```

Use `validateInput: "warn"` to emit a warning and continue rendering.

See [Prompt Validation](/prompt/validation).

## Deprecation Warnings

Deprecated LLM shorthands still resolve, but emit a Node `DeprecationWarning` with code `LLM_EXE_DEPRECATED` on first use in the current process.

Migration:

- Move deprecated shorthands to an active shorthand or explicit provider/model config.
- Listen for `process.on("warning")` if your application needs to route these warnings into logging.
- Do not parse docs for deprecated model lists manually; provider model lists are generated.

```ts
process.on("warning", (warning) => {
  if (warning.code === "LLM_EXE_DEPRECATED") {
    console.warn(warning.message);
  }
});
```

See [Deprecation Warnings](/llm/deprecations).


## Custom Parser Context Is Now ExecutionContext

Custom parser callbacks now receive `ExecutionContext` instead of the old `ExecutorContext` object.

In 2.x, custom parsers were typed as though execution metadata fields were available at the top level of the second argument:

```ts
import type { ExecutorContext } from "llm-exe";

const parser = createCustomParser("example", (
  text,
  context: ExecutorContext<Input, Output>
) => {
  return {
    input: context.input,
    handlerInput: context.handlerInput,
    executorName: context.metadata.name,
  };
});
```

In 3.x, execution metadata is under `context.execution`, executor metadata is under `context.executor`, and the resolved trace ID is available as `context.traceId`:

```ts
import type { ExecutionContext } from "llm-exe";

const parser = createCustomParser("example", (
  text,
  context: ExecutionContext<Input, Output>
) => {
  return {
    input: context.execution.input,
    handlerInput: context.execution.handlerInput,
    executorName: context.executor.name,
    traceId: context.traceId,
  };
});
```

Migration:

- Replace `ExecutorContext` annotations on custom parser callbacks with `ExecutionContext`.
- Move execution metadata reads from `context.input`, `context.handlerInput`, `context.handlerOutput`, and `context.output` to `context.execution.input`, `context.execution.handlerInput`, `context.execution.handlerOutput`, and `context.execution.output`.
- Move executor metadata reads from `context.metadata` to `context.executor`.
- Use `context.traceId` for the resolved per-call trace ID.
- `ExecutorContext` may still exist as a compatibility type, but it is no longer the runtime object passed to custom parsers.

See [ExecutionContext](/executor/execution-context).

## Parser Type Inference

Schema-aware parsers continue to carry schema-derived output types through `ParserOutput`.

```ts
const parser = createParser("json", { schema });
type Output = ParserOutput<typeof parser>;
```

`createParser("stringExtract", ...)` requires enum options because the parser is not useful without configured values.

Migration:

- Pass `enum` when constructing `stringExtract`.
- Prefer `defineSchema(...)` for schema literals so parser output inference remains precise.
