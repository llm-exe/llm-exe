---
title: "Parse LLM Output into JSON, Lists, and Booleans | llm-exe"
description: "Reference for llm-exe's built-in parsers: JSON, number, boolean, lists, markdown code blocks, and more. Turn raw LLM responses into typed TypeScript data."
---

# Default Included Parsers

[[toc]]

## String Parser

`string`
The default parser. Doesn't really parse, it passes through the string response with no modification.
Returns: string

```ts
const parser = createParser("string");
```

::: code-group

```[Output]
This is an example input message.
```

```[Response]
This is an example input message.
```

:::

## Number Parser

`number`
Extracts exactly one number from the LLM response.
Returns: number

```ts
const parser = createParser("number");
```

Options:
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `match` | `"extract" \| "exact"` | `"extract"` | `"extract"` finds one numeric token in the response. `"exact"` requires the entire trimmed response to be one numeric token. |

::: code-group

```[Output]
42
```

```[Response]
The answer is 42.
```

:::

## Boolean Parser

`boolean`
Parses a boolean value from the LLM response. Recognizes common truthy/falsy patterns like "true", "false", "yes", "no".
Returns: boolean

```ts
const parser = createParser("boolean");
```

Options:
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `match` | `"exact" \| "extract"` | `"exact"` | `"exact"` requires the entire trimmed response to be one boolean literal. `"extract"` finds one boolean literal in surrounding text. |

See a complete recipe using this parser: [Get a Yes/No Decision from an LLM](/examples/bots/yes-no.html).

::: code-group

```[Output]
true
```

```[Response]
yes
```

:::

## String Extractor Parser

`stringExtract`
Use this parser to ensure the response is one of many specific strings you define. This parser does not return the LLM's actual response, but works through the `enum` you provide and looks for a match. When it finds one, it returns the `enum` value, ensuring the response is exactly as expected.

Returns: string

> **Example Prompt:** <br>You need to reply with one of three options. Either stop, go forward, turn left, turn right.

```ts
const parser = createParser("stringExtract", {
  enum: ["stop", "go forward", "turn left", "turn right"],
});
```

Options:
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enum` | `string[]` | `[]` | The list of allowed values to match against. |
| `ignoreCase` | `boolean` | `true` | When `true`, matching is case-insensitive. |
| `match` | `"word" \| "substring" \| "exact"` | `"word"` | `"word"` matches enum values on word boundaries. `"substring"` uses contains matching. `"exact"` requires the entire trimmed response to equal one enum value. |

::: code-group

```[Output]
go forward
```

```[Response]
Go Forward.
```

:::

## List to Array

`listToArray`
Converts a list (separated by \n) to an array of strings.
Returns: string[]

> **Example Prompt:** <br>You need to reply with a list of test cases that should be written for the code I included below. You must reply in an unordered list.

```ts
const parser = createParser("listToArray");
```

::: code-group

```[Output]
[
 "Should return the default name if the function argument is null or undefined",
 "Should return function's name if function has a name property",
 "Should return the correct name if function is bound to an object",
 "Should return the correct name if function is anonymous",
 "Should return the correct name if the function's source has additional space",
 "Should return empty string if function has no applicable name.",
]
```

```[Response]
- Should return the default name if the function argument is null or undefined
- Should return function's name if function has a name property
- Should return the correct name if function is bound to an object
- Should return the correct name if function is anonymous
- Should return the correct name if the function's source has additional space
- Should return empty string if function has no applicable name.
```

:::

## List to Key/Value[]

`listToKeyValue`
Converts a list of `key: value` pairs (separated by newlines) to an array of key/value objects.
Returns `Array<{ key: string; value: string; }>`

::: code-group

```[Output]
[{
    "key": "Getting Started",
    "value": "To get started, we need to..."
},{
    "key": "Setting Up Your Account",
    "value": "To set up your account, you need to..."
}]
```

```[Response]
Getting Started: To get started, we need to...
Setting Up Your Account: To set up your account, you need to...
```

:::

## Markdown Code Block

`markdownCodeBlock`
Extracts the **first** code block from the LLM response, including the language identifier. If the response contains no code blocks, returns `{ code: "", language: "" }`. For extracting all code blocks, see [`markdownCodeBlocks`](#markdown-code-blocks) below.
Returns: `{ code: string; language: string; }`

```ts
const parser = createParser("markdownCodeBlock");
```

::: code-group

```[Output]
{
    "code": "function add(a: number, b: number){\nreturn a + b;\n}",
    "language": "typescript"
}
```

````[Response]
Below is the generated code:

```typescript
function add(a: number, b: number){
    return a + b;
}
```
````

:::

## Markdown Code Blocks

`markdownCodeBlocks`
Extracts **all** code blocks from the LLM response, returning them as an array. Use this when the response may contain multiple code blocks. For extracting only the first code block, see [`markdownCodeBlock`](#markdown-code-block) above.
Returns: `Array<{ code: string; language: string; }>`

```ts
const parser = createParser("markdownCodeBlocks");
```

::: code-group

```[Output]
[{
    "code": "function add(a: number, b: number){\nreturn a + b;\n}",
    "language": "typescript"
},
{
    "code": "function subtract(a: number, b: number){\nreturn a - b;\n}",
    "language": "typescript"
}]
```

````[Response]
Below is the generated code:

```typescript
function add(a: number, b: number){
    return a + b;
}
```

And the next:

```typescript
function subtract(a: number, b: number){
    return a - b;
}
```
````

:::

## Replace String Template

`replaceStringTemplate`
Runs Handlebars substitution on the LLM's output, using the executor's input attributes as template data. This lets the LLM return a template string that gets filled in with the original input variables before being returned to the caller.

Returns: string

```ts
const parser = createParser("replaceStringTemplate");
```

**Use case:** The LLM generates a response containing placeholders, and the parser fills them in with known values from the executor input — useful for personalized messages, dynamic templates, or mail-merge patterns.

::: code-group

```[Output]
Hello Alice! Your order #12345 has shipped.
```

```[Response]
Hello {{name}}! Your order #{{orderId}} has shipped.
```

```[Attributes passed to parser]
{ name: "Alice", orderId: "12345" }
```

:::

## List to JSON

`listToJson`
Parses key:value lines (separated by newlines) into a **single flat object**. Each line becomes one property — the key is derived from the text before the first colon, and the value is the text after it. Keys are camelCased by default.

Returns: object (flat key-value pairs)

::: warning
This parser produces a single object, not an array. If the LLM output contains duplicate keys, later values overwrite earlier ones. If you need to preserve multiple records with the same keys, use [`listToKeyValue`](#list-to-key-value) instead (which returns an array of `{ key, value }` pairs).
:::

> **Example Prompt:** <br>Extract the following information. Reply only with: Color: the color\nName: the name\nType: the type

```typescript
const parser = createParser("listToJson");
```

Options:
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `keyTransform` | `"camelCase" \| "preserve"` | `"camelCase"` | How to transform keys. `"camelCase"` converts keys like "First Name" to "firstName". `"preserve"` keeps the original key text (trimmed). |
| `schema` | `JSONSchema` | `undefined` | Optional JSON Schema to validate and enforce types on the output. |
| `validateSchema` | `boolean` | `true` (when `schema` is set) | When a schema is provided, `required` fields and type/constraint checks are enforced by default. Set to `false` to opt out into filter/default-only behavior (strips unknown keys and applies defaults, but does **not** check `required`). |

::: code-group

```[Output]
{
    "color": "red",
    "name": "apple",
    "type": "fruit"
}
```

```[Response]
Color: Red
Name: Apple
Type: Fruit
```

:::

**Choosing between `listToJson` and `listToKeyValue`:**

| Parser | Returns | Best for |
| --- | --- | --- |
| `listToJson` | `{ key: value, ... }` (flat object) | Extracting a fixed set of unique fields from a response |
| `listToKeyValue` | `Array<{ key, value }>` | Preserving order, handling duplicate keys, or iterating over pairs |

## JSON

`json`
Parse an expected stringified JSON object or array into a valid object. Schema can be passed in to enforce schema and provide default values.
Returns: object | array

```ts
const parser = createParser("json");
```

Options:
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `schema` | `JSONSchema` | `undefined` | Optional JSON Schema to validate and enforce types on the output. Use with [`defineSchema`](/parser/index.html#defineschema) for full type inference. |
| `validateSchema` | `boolean` | `true` (when `schema` is set) | When a schema is provided, `required` fields and type/constraint checks are enforced by default — invalid or incomplete input throws `parser.schema_validation_failed`. Set to `false` to opt out into filter/default-only behavior (strips unknown keys and applies defaults, but does **not** check `required`). |
| `match` | `"exact" \| "extract"` | `"exact"` | `"exact"` parses the entire response as JSON. `"extract"` finds one JSON object or array in surrounding text. |

::: warning
Providing a `schema` enforces `required` fields by default. Input missing a required field throws rather than returning a partial object. Defaults are applied **after** validation, so a `default` does not satisfy a `required` field. Pass `validateSchema: false` only if you intentionally want the legacy strip-and-default behavior without `required` enforcement.
:::

::: code-group

```[Output]
{
    "name": "Greg",
    "age": "89"
}
```

```[Response]
\`\`\`json
{ "name": "Greg", "age": "89" }
\`\`\`

or

{ \"name\": \"Greg\", \"age\": \"89\" }
```

:::

---

::: tip
You still need to instruct the LLM to respond with a certain format, and the parser will turn that response into a data-type useful to your application.
:::
