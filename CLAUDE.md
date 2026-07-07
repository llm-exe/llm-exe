# llm-exe — Claude Code Context

## Philosophy

llm-exe is a lightweight, modular TypeScript toolkit for building LLM-powered applications.
Core pattern: **Prompt → LLM → Parser → Typed Result** — make LLM calls feel like regular typed functions.

### Guiding Principles

- **Lightweight.** Thin abstraction layer. No heavy frameworks, minimal dependencies, small surface area. We are a utility, not a platform.
- **Provider-agnostic.** One interface, any LLM. We internally normalize messages, responses, and tool calls so application code never touches provider-specific shapes.
- **TypeScript-first. This is non-negotiable.** Full type inference must flow from prompt input → parser output → executor return type. No `any` types. No broken inference chains. No manual casting. The type safety on LLM responses is what makes llm-exe valuable — tiny leaks in the response types destroy the entire value prop.
- **Modular.** Four pillars — Prompt, LLM, Parser, Executor — each works independently and composes together. Respect module boundaries: prompt logic in prompts, parsing in parsers, orchestration in executors, provider calls in LLM.
- **Text-out scope** (currently). We support tool/function calls via our normalized interface, and image *input* via `image_url` content blocks (https URL or base64 `data:` URI, converted to each provider's native shape at the provider-config layer). Output is text-only — no image generation, audio, or video support at this time.

## Feature Evaluation — Read This Before Adding Features

We do NOT race to support every new LLM feature. The AI landscape moves fast and most new capabilities are experimental, provider-specific, or short-lived. If we chased everything, we'd drown in tech debt and never ship a stable release.

Before adding a feature, ask:
- **Broad adoption?** Is this something multiple providers support (or will)? Or is it one provider's experiment?
- **Longevity?** Will this stand the test of time? Or is it speculative and likely to change or disappear?
- **Lightweight?** Does it keep us thin, or does it add weight/complexity we can't justify?
- **Type-safe?** Does it preserve end-to-end type inference? Can we type the inputs and outputs cleanly?
- **Module boundaries?** Does it respect the separation between Prompt, LLM, Parser, and Executor?

Strategic, deliberate additions only. Every property we support is a commitment we maintain.

## How It Works

The executor is the glue. It binds a prompt + LLM + parser into a single typed async function:

```typescript
const executor = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),         // provider.model — one interface, any backend
  prompt: createChatPrompt<{ text: string }>(  // Handlebars template — typed input
    "Summarize: {{text}}"
  ),
  parser: createParser("json", { schema }),    // parser defines the output type
});

const result = await executor.execute({ text: "..." });
// result is fully typed — inferred from the parser
```

**Type flow**: prompt generic defines the input type, parser defines the output type, executor infers both. No casting. If the parser returns `string[]`, the executor returns `Promise<string[]>`.

### Prompts
- `createChatPrompt<InputType>(instruction)` — creates a chat prompt with system/user/assistant messages
- Handlebars templating: `{{variable}}`, `{{#if}}`, `{{#each}}`, `{{> partial}}`
- `.addUserMessage()`, `.addSystemMessage()`, `.addAssistantMessage()` for multi-turn
- `.format(data)` renders the template — type-checked against the generic

### LLM
- **Shorthand** (typed): `useLlm("openai.gpt-4o-mini")` — curated, explicitly supported models with full type support
- **Options-based** (flexible): `useLlm("openai.chat.v1", { model: "gpt-4o" })` — generic provider interface + model in options. Lets users use any model the provider supports without us needing to ship a new shorthand.
- Returns a normalized interface: `.call(prompt)` → `OutputResult` with `.getResultText()`
- Built-in retries and timeouts
- All responses normalized to `OutputResult` regardless of provider
- See https://llm-exe.com/llm/openai.html#basic-usage for full provider docs

### Parsers
- Built-in: `string`, `json`, `listToArray`, `listToKeyValue`, `stringExtract`, `markdownCodeBlock`, `boolean`, `number`
- `createParser("type", options?)` — returns a typed parser
- `createCustomParser<OutputType>("name", (input, context) => result)` — for custom logic
- The parser's return type becomes the executor's return type — this is where the type safety pays off

### Executors
- `createLlmExecutor({ llm, prompt, parser })` — the standard executor
- Supports hooks: `onSuccess`, `onError`, `onComplete` for logging/metrics
- Composable: one executor's output feeds another's input
- `LlmExecutorWithFunctions` — supports tool/function calling

## Project Structure

```
src/
  executor/    — BaseExecutor, LlmExecutor, CoreExecutor, LlmExecutorWithFunctions
  llm/         — Provider abstraction (OpenAI, Anthropic, Google, xAI, Deepseek, Bedrock, Ollama)
  prompt/      — Handlebars-based templating (ChatPrompt, TextPrompt)
  parser/      — Output parsing (JSON, String, Number, Boolean, List*, MarkdownCodeBlock, Custom)
  state/       — Dialogue (chat history), BaseState, BaseStateItem
  interfaces/  — All TypeScript interfaces

scripts/
  maintain.sh  — Entry point for maintenance agents
  agents/      — Agent config, prompts, and logs (see agents/README.md)
```

## Commands

```bash
npm test                # Jest test suite (152 suites, 1275+ tests)
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build:ci        # tsup (CJS/ESM/DTS)
```

## Conventions

- Tests are co-located: `[file].test.ts` next to implementation
- Mock LLM providers: `openai.chat-mock.v1` (echo input back)
- Mock helper: `mockOutputResultObject(content[], options?)` in `utils/mock.helpers.ts`
- All LLM responses normalize to `OutputResult` with `content: OutputResultContent[]` — this normalization layer is how we stay provider-agnostic
- Tool calls are normalized internally so application code uses one shape regardless of provider
- Branch naming: `agent/<role>/<date>` for automated maintenance

## Versioning & Releases

We follow [semver](https://semver.org/). Check current version with `node -p "require('./package.json').version"` and recent releases with `gh release list --limit 5`.

- **patch** (2.3.x) — bug fixes, no API changes. Most fixes are patches.
- **minor** (2.x.0) — new features that are fully backwards-compatible. New parsers, new provider support, new options on existing APIs.
- **major** (x.0.0) — breaking changes. Rare. Changing return types, removing/renaming exports, altering behavior that existing users depend on.

When filing an issue:
- If the fix changes public API behavior or types that consumers rely on, label it `breaking` and assign it to the next major milestone (create one if it doesn't exist, e.g. `v3.0.0`).
- Non-breaking bugs/features get the current minor or patch milestone.
- When in doubt, it's probably not breaking. Only label `breaking` if existing user code would need to change.

The maintainer decides when to cut releases. Agents organize — the human ships.

## PR Guidelines

- Run `npm test` and `npm run typecheck` before submitting
- Keep PRs focused — one concern per PR
- Include test coverage for new code
- Verify type inference is preserved — if a change touches response types, executor generics, or parser output, confirm that downstream consumers still infer correctly without casting

## Known Issues (should fix)

- Worker process force exit warning in test suite (potential timer leak in asyncCallWithTimeout.test.ts)

