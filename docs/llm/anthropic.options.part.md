| Option          | Type    | Default   | Description                                                                      |
| --------------- | ------- | --------- | -------------------------------------------------------------------------------- |
| anthropicApiKey | string  | undefined | API key for Anthropic. Optionally can be set using process.env.ANTHROPIC_API_KEY |
| model           | string  | —         | The model to use. Must be specified when using `anthropic.chat.v1`.              |
| temperature     | number  | undefined | Maps to temperature. See Anthropic Docs                                          |
| maxTokens       | number  | 4096      | Maps to max_tokens. See Anthropic Docs                                           |
| effort          | string  | undefined | Maps to reasoning effort / thinking. See the effort note below.                  |
| topP            | number  | undefined | Maps to top_p. See Anthropic Docs                                                |
| topK            | number  | undefined | Maps to top_k. See Anthropic Docs                                                |
| stopSequences   | array   | undefined | Maps to stop_sequences. See Anthropic Docs                                       |
| stream          | boolean | undefined | Note: Not supported yet.                                                         |
| metadata        | object  | undefined | Maps to metadata. See Anthropic Docs                                             |
| serviceTier     | string  | undefined | Maps to service_tier. See Anthropic Docs                                         |

> [!NOTE]
> **Sampling parameter restrictions:** `claude-opus-4-7`, `claude-opus-4-8`, `claude-opus-5`, `claude-sonnet-5`, and `claude-fable-5` reject requests that include `temperature`, `topP`, or `topK` — llm-exe silently drops these for those models. For other Claude 4.x models, `topP` is silently dropped when `temperature` is also set, because the Anthropic API does not allow both simultaneously.

> [!NOTE]
> **`effort`:** Accepts `minimal`/`low`/`medium`/`high`. For the adaptive generation (Opus 4.6 / 4.7 / 4.8 / 5, Sonnet 4.6 / 5, Fable 5) it sets `output_config.effort` and adaptive `thinking`; `high` escalates to `xhigh` on Opus 4.7 / 4.8, and in that escalated case, if you do not pass `maxTokens`, its default is raised from 4096 to 65536 so adaptive thinking is not truncated (an explicit `maxTokens` is always honored). For the 4.5 generation it sets extended-thinking `budget_tokens` and raises `max_tokens` above the budget. Because `effort` enables thinking, and Anthropic disallows sampling parameters while thinking is active, omit `topP` (or set it `>= 0.95`) when using `effort` — a lower `topP` returns a 400.

Anthropic Docs: [link](https://docs.anthropic.com/en/api/messages)
