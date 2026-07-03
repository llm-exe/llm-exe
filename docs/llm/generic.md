---
title: "Configure Generic LLM Options in TypeScript | llm-exe"
description: "Configure generic LLM options in TypeScript with llm-exe: timeout, retries, temperature, maxTokens, topP, and reasoning effort, normalized across providers."
---

# Generic Options

llm-exe attempts to normalize the inputs for various llm vendors, providing a single interface that can be used to interact with different models. While this is not always possible, since certain vendors may implement features that others don't support, either way only the allowed options make it to the respective api calls.

## Options

For a worked example of `timeout`, `numOfAttempts`, and `maxDelay` in a production setup, see [Add Retries and Timeouts to LLM Calls](/examples/concepts/retries-and-timeouts.html).

| Option        | Type             | Default   | Description                                                                                                |
| ------------- | ---------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| timeout       | number           | 30000     | Max execution time of API call to the LLM, in milliseconds.                                                |
| maxDelay      | number           | 5000      | Used for retry back-off. Max time to wait between attempts when timeout has been reached, in milliseconds. |
| numOfAttempts | number           | 2         | Used for retry. How many attempts should be made before throwing error                                     |
| jitter        | "none" \| "full" | none      | Used for retry back-off.                                                                                   |
| temperature   | number           | undefined | Maps to provider-specific temperature parameter.                                                           |
| maxTokens     | number           | undefined | Maps to provider-specific max tokens parameter.                                                            |
| topP          | number           | undefined | Maps to provider-specific top_p parameter.                                                                 |
| stopSequences | string[]         | undefined | Maps to provider-specific stop sequences parameter.                                                        |
| effort        | string           | undefined | Maps to reasoning effort. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Only supported by providers/models that support reasoning effort (e.g. OpenAI gpt-5, Google Gemini 2.5). |
| stream        | boolean \| null  | null      | Note: Not supported yet.                                                                                   |

> [!NOTE]
> Different vendors will allow (and may require) additional options.
> - [OpenAI Chat Model Options](/llm/openai#openai-specific-options)
> - [Anthropic Chat Model Options](/llm/anthropic#anthropic-specific-options)
> - [Google Gemini Chat Model Options](/llm/gemini#gemini-specific-options)
> - [xAI Chat Model Options](/llm/xai#xai-specific-options)
> - [Deepseek Chat Model Options](/llm/deepseek#deepseek-specific-options)
> - [Ollama Chat Model Options](/llm/ollama#ollama-specific-options)
> - [AWS Bedrock Chat Model Options](/llm/bedrock/index.html)

