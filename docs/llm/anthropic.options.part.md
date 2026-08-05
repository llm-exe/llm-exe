| Option          | Type    | Default           | Description                                                                      |
| --------------- | ------- | ----------------- | -------------------------------------------------------------------------------- |
| anthropicApiKey | string  | undefined         | API key for Anthropic. Optionally can be set using process.env.ANTHROPIC_API_KEY |
| model           | string  | —                 | The model to use. Must be specified when using `anthropic.chat.v1`.              |
| temperature     | number  | undefined         | Maps to temperature. See Anthropic Docs                                          |
| maxTokens       | number  | 4096              | Maps to max_tokens. See Anthropic Docs                                           |
| topP            | number  | undefined         | Maps to top_p. See Anthropic Docs                                                |
| topK            | number  | undefined         | Maps to top_k. See Anthropic Docs                                                |
| stopSequences   | array   | undefined         | Maps to stop_sequences. See Anthropic Docs                                       |
| stream          | boolean | undefined         | Note: Not supported yet.                                                         |
| metadata        | object  | undefined         | Maps to metadata. See Anthropic Docs                                             |
| serviceTier     | string  | undefined         | Maps to service_tier. See Anthropic Docs                                         |

> [!NOTE]
> **Sampling parameter restrictions:** `claude-opus-4-7` rejects requests that include `temperature`, `topP`, or `topK` — llm-exe silently drops these for that model. For other Claude 4.x models, `topP` is silently dropped when `temperature` is also set, because the Anthropic API does not allow both simultaneously.
>
> **`maxTokens` default with escalated effort:** For `claude-opus-4-7` and `claude-opus-4-8`, llm-exe escalates `effort: "high"` to Anthropic's `xhigh`. In that case only, if you do not pass `maxTokens`, the default is raised from 4096 to 65536 so adaptive thinking is not truncated (Anthropic recommends a large `max_tokens` at `xhigh`). An explicit `maxTokens` (any value, including 4096) is always honored, and every other model keeps the 4096 default.

Anthropic Docs: [link](https://docs.anthropic.com/en/api/messages)
