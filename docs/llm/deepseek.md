# Deepseek

When using Deepseek models, llm-exe will make POST requests to `https://api.deepseek.com/v1/chat/completions`. All models are supported if you pass `deepseek.chat.v1` as the first argument, and then specify a model in the options.

llm-exe ships typed shorthands for the most common Deepseek models so you do not have to remember the exact model strings:

| Shorthand              | Default model        |
| ---------------------- | -------------------- |
| `deepseek.chat.v1`     | _none — set `model`_ |
| `deepseek.chat`        | `deepseek-chat`      |
| `deepseek.v4-flash`    | `deepseek-v4-flash`  |
| `deepseek.v4-pro`      | `deepseek-v4-pro`    |

## Basic Usage

### Deepseek Chat

```ts
const llm = useLlm("deepseek.chat.v1", {
  model: "deepseek-chat", // specify a model
});
```

### Deepseek Chat By Model

```ts
const llm = useLlm("deepseek.chat", {
  // other options,
  // no model needed, using deepseek-chat model
});
```

```ts
const llm = useLlm("deepseek.v4-flash", {
  // other options,
  // no model needed, using deepseek-v4-flash model
});
```

```ts
const llm = useLlm("deepseek.v4-pro", {
  // other options,
  // no model needed, using deepseek-v4-pro model
});
```

<ImportModelNames provider="deepseek" />

## Authentication

To authenticate, you need to provide a Deepseek API Key. You can provide the API key various ways, depending on your use case.

1. Pass in as execute options using `deepseekApiKey`
2. Pass in as setup options using `deepseekApiKey`
3. Use a default key by setting an environment variable of `DEEPSEEK_API_KEY`

Generally you pass the LLM instance off to an LLM Executor and call that. However, it is possible to interact with the LLM object directly, if you wanted.

```ts
// call the LLM directly with a prompt
await llm.call(prompt);
```

## Deepseek-Specific Options

In addition to the generic options, the following options are Deepseek-specific and can be passed in when creating a llm function.

| Option           | Type    | Default       | Description                                                    |
| ---------------- | ------- | ------------- | -------------------------------------------------------------- |
| model            | string  | —             | The model to use. Must be specified when using `deepseek.chat.v1`. Can be any valid chat model. See Deepseek Docs |
| deepseekApiKey   | string  | undefined     | API key for Deepseek. See [authentication](/llm/deepseek#authentication) |
| topP             | number  | undefined     | Maps to `top_p`. See Deepseek Docs                             |
| stopSequences    | array   | undefined     | Maps to `stop`. See Deepseek Docs                              |
| frequencyPenalty | number  | undefined     | Maps to `frequency_penalty`. See Deepseek Docs                 |
| logitBias        | object  | undefined     | Maps to `logit_bias`. See Deepseek Docs                        |
| useJson          | boolean | undefined     | When `true`, sets `response_format` to `json_object`           |
| effort           | string  | undefined     | Maps to `reasoning_effort`. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Currently not supported by Deepseek models and will be silently ignored. |

See [Deepseek API Reference](https://api-docs.deepseek.com/) for details on these parameters.
