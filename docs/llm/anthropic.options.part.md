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
| effort          | string  | undefined         | Reasoning effort. Valid values: `"minimal"`, `"low"`, `"medium"`, `"high"`. Anything else is dropped. Mapped per model — see below. |

> [!NOTE]
> **Sampling parameter restrictions:** `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-opus-4-7`, and `claude-opus-4-8` reject requests that include `temperature`, `topP`, or `topK` — llm-exe silently drops these for those models. For other Claude 4.x models, `topP` is silently dropped when `temperature` is also set, because the Anthropic API does not allow both simultaneously.
>
> **How `effort` maps:** On the adaptive-thinking models (`claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-opus-4-6`, `claude-opus-4-7`, `claude-opus-4-8`, `claude-sonnet-4-6`) llm-exe sends `thinking: { type: "adaptive" }` and maps `minimal`/`low` → `low`, `medium` → `medium`, `high` → `high`. On the 4.5 generation (`claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5`) it instead sends an explicit thinking budget — 1024 / 4096 / 10240 / 32768 tokens for `minimal` / `low` / `medium` / `high` — and raises `maxTokens` above that budget when needed, since Anthropic counts thinking tokens against `max_tokens`. On any other model `effort` is ignored.
>
> **`maxTokens` default with escalated effort:** `claude-opus-4-7` and `claude-opus-4-8` are the exception to the mapping above — llm-exe escalates `effort: "high"` to Anthropic's `xhigh` for them. In that case only, if you do not pass `maxTokens`, the default is raised from 4096 to 65536 so adaptive thinking is not truncated (Anthropic recommends a large `max_tokens` at `xhigh`). An explicit `maxTokens` (any value, including 4096) is always honored, and every other model keeps the 4096 default. `claude-opus-5` is deliberately *not* escalated — Anthropic recommends starting at `high` there.

Anthropic Docs: [link](https://docs.anthropic.com/en/api/messages)
