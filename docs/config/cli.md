---
title: "CLI | Run Config Files from the Terminal"
description: "Run llm-exe config files from the command line."
---

# CLI

The `llm-exe` command runs a [config file](/config/index.html) from your terminal.

```bash
llm-exe ./summarize.yml --data.text "Long article..."
```

If the package is not installed globally, use `npx`.

```bash
npx llm-exe ./summarize.yml --data.text "Long article..."
```

The CLI uses the same config format as the TypeScript API. It loads the file, builds the executor, runs it, and prints the result.

## Basic Usage

```bash
llm-exe <path> [options]
```

`<path>` should be a config file:

- `.json`
- `.yml`
- `.yaml`
- `.md`

URLs are supported too, but only with `--remote`.

```bash
llm-exe https://example.com/summarize.yml --remote
```

Without `--remote`, URLs are refused.

## Passing Data

Use `--data.<key>` to pass template values.

```bash
llm-exe ./summarize.yml --data.text "Long article..."
```

Dotted keys create nested objects.

```bash
llm-exe ./hello.yml --data.user.name Greg
```

That becomes:

```json
{
  "user": {
    "name": "Greg"
  }
}
```

Values from the command line override values in the file. `data` is merged; top-level fields replace.

```bash
llm-exe ./summarize.yml --data.text "Different text" --model gpt-4.1
```

## Reading stdin

Use `--stdin <key>` to bind piped input to a data variable.

```bash
npm test 2>&1 | llm-exe ./explain-failure.yml --stdin log
```

Example config:

```yaml
provider: openai.gpt-4o-mini
system: You are a senior engineer.
message: "Explain why this failed and suggest a fix:\n\n{{log}}"
```

stdin is only read when `--stdin` is present, so the command will not sit around waiting for input when you are not piping anything.

## Output

By default, the result is written to stdout.

```bash
llm-exe ./summarize.yml > summary.txt
```

Errors and debug output go to stderr.

Use `--json` when you want the result and metadata together.

```bash
llm-exe ./summarize.yml --json
```

```json
{
  "result": "...",
  "metadata": {}
}
```

Use `--debug` to print execution metadata to stderr.

```bash
llm-exe ./summarize.yml --debug
```

The exit code is `0` on success and `1` on errors.

## Options

**`--data.<key> <value>`**  
Set a template value. Dotted keys are nested.

**`--model <value>`**  
Override `model` in the config.

**`--provider <value>`**  
Override `provider` in the config. This should be a real `useLlm` provider key, like `openai.chat.v1`.

**`--parser <value>`**  
Override `parser` in the config.

**`--stdin <key>`**  
Read stdin and put it at `data[key]`.

**`--json`**  
Print `{ result, metadata }` instead of only the result.

**`--debug`**  
Print execution metadata to stderr.

**`--remote`**  
Allow loading a config from an `http` or `https` URL.

**`-h`, `--help`**  
Print help.

**`-v`, `--version`**  
Print the installed version.

## Auth

The CLI uses the same environment variables as the package.

For example:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`
- `DEEPSEEK_API_KEY`

There is no separate CLI login or key storage.

## Try it with no key

Use the mock provider to test the command without an API key.

```yaml
# hello.yml
provider: openai.chat-mock.v1
message: "Hello {{name}}"
data:
  name: World
```

```bash
llm-exe ./hello.yml
```

## Piping

Because the result goes to stdout, the CLI works well with pipes.

```bash
llm-exe ./extract.yml --json | jq ".result.sentiment"
```

One config can feed another.

```bash
llm-exe ./outline.yml --data.topic "rate limiting" \
  | llm-exe ./draft-from-outline.yml --stdin outline
```

If your config uses the JSON parser, the result is already structured.

```yaml
provider: openai.gpt-4o-mini
message: "Extract sentiment from: {{text}}"
parser: json
parserOptions:
  schema:
    type: object
    properties:
      sentiment:
        type: string
    required: [sentiment]
```

```bash
llm-exe ./extract.yml --data.text "I love this" --json | jq ".result"
```

## Tool Calls

A config can include function schemas under `executorOptions.functions`.

```yaml
provider: openai.gpt-4o-mini
message: What is the weather in {{city}}?
data:
  city: Denver
executorOptions:
  functionCall: auto
  functions:
    - name: get_weather
      description: Get the weather for a city.
      parameters:
        type: object
        properties:
          city:
            type: string
        required: [city]
```

The CLI returns the model output. If the model chooses a tool, you get the tool call data. The CLI does not run the tool handler for you.

```bash
llm-exe ./weather.yml --json | jq ".result"
```

Run the handler in your own code or shell script, then pass the result into another config if needed.

```bash
forecast=$(curl -s "https://api.example.com/weather?city=Denver")
echo "$forecast" | llm-exe ./answer.yml --stdin forecast --data.city Denver
```
