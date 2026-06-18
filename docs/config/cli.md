---
title: "CLI | Run Prompt Files from the Terminal"
description: "Run llm-exe prompt files from the command line."
---

# CLI

The `llm-exe` command runs prompt files.

```bash
llm-exe ./summarize.yml --data.text "Long article..."
```

Use `npx` if the package is not installed globally.

```bash
npx llm-exe ./summarize.yml --data.text "Long article..."
```

The result is written to stdout, so it works well with pipes and CI logs.

```bash
npm test 2>&1 | llm-exe ./explain-failure.yml --stdin log
```

## Write a Prompt File

```yaml
# summarize.yml
provider: openai.gpt-4o-mini
message: "Summarize: {{text}}"
parser: string
```

Run it:

```bash
llm-exe ./summarize.yml --data.text "Long article..."
```

Prompt files can be JSON, YAML, or Markdown. See [Prompt File Formats](/config/formats.html).

## Pass Data

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

Command-line values override values in the file. `data` is merged; top-level fields replace.

```bash
llm-exe ./summarize.yml --data.text "Different text" --model gpt-4.1
```

## Pipe stdin

Use `--stdin <key>` to bind piped input to a data variable.

```bash
npm test 2>&1 | llm-exe ./explain-failure.yml --stdin log
```

```yaml
# explain-failure.yml
provider: openai.gpt-4o-mini
system: You are a senior engineer.
message: "Explain why this failed and suggest a fix:\n\n{{log}}"
```

stdin is only read when `--stdin` is present.

## Parse Output

Prompt files can use llm-exe parsers.

```yaml
# extract.yml
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

Use `--json` when you want the result and metadata as JSON.

```bash
llm-exe ./extract.yml --data.text "I love this" --json | jq ".result"
```

Without `--json`, only the parsed result is printed.

```bash
llm-exe ./summarize.yml --data.text "Long article..." > summary.txt
```

Errors and debug output go to stderr. The exit code is `0` on success and `1` on errors.

## Chain Prompt Files

One prompt file can feed another.

```bash
llm-exe ./outline.yml --data.topic "rate limiting" \
  | llm-exe ./draft-from-outline.yml --stdin outline
```

This is often enough for small local workflows and CI jobs.

## Options

```bash
llm-exe <path> [options]
```

**`--data.<key> <value>`**  
Set a template value. Dotted keys are nested.

**`--model <value>`**  
Override `model` in the file.

**`--provider <value>`**  
Override `provider` in the file. This should be a real `useLlm` provider key, like `openai.chat.v1`.

**`--parser <value>`**  
Override `parser` in the file.

**`--stdin <key>`**  
Read stdin and put it at `data[key]`.

**`--json`**  
Print `{ result, metadata }` instead of only the result.

**`--debug`**  
Print execution metadata to stderr.

**`--remote`**  
Allow loading a prompt file from an `http` or `https` URL.

**`-h`, `--help`**  
Print help.

**`-v`, `--version`**  
Print the installed version.

## Remote Files

Local files are the default.

```bash
llm-exe ./summarize.yml
```

Remote files require `--remote`.

```bash
llm-exe https://example.com/summarize.yml --remote
```

Without `--remote`, URLs are refused.

## Auth

The CLI uses the same environment variables as the package.

For example:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`
- `DEEPSEEK_API_KEY`

There is no separate CLI login.

## Try It with No Key

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

## Tool Calls

A prompt file can include function schemas.

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

Run the handler in your own code or shell script, then pass the result into another prompt file if needed.

```bash
forecast=$(curl -s "https://api.example.com/weather?city=Denver")
echo "$forecast" | llm-exe ./answer.yml --stdin forecast --data.city Denver
```
