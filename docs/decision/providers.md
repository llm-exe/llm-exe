---
title: "Decision Model Providers: OpenAI, TypeSafe Jev, Cloudflare Clef | llm-exe"
description: "Model keys, options, environment variables, and limits for decision models in llm-exe: OpenAI Decisions (gpt-6-luna), TypeSafe Jev, and Cloudflare Clef."
---

# Decision Model Providers

Every provider works with the same [decision executor](/decision/) and returns the same answer shape. This page covers what's different: the model key, how to authenticate, and the limits.

| Provider | Key | Model | Max questions |
|----------|-----|-------|---------------|
| OpenAI | `openai.gpt-6-luna` | `gpt-6-luna` | 400 |
| OpenAI (any model or compatible server) | `openai.decisions.v1` | set `model` | 400 |
| TypeSafe | `typesafe.jev` | `jev-latest` | 400 |
| Any System One server | `typesafe.systemone.v1` | set `model` | 400 |
| Cloudflare Workers AI | `cloudflare.clef` | `clef` | 64 |
| Cloudflare Workers AI | `cloudflare.clef-flash` | `clef-flash` | 64 |

## OpenAI

Calls OpenAI's Decisions API (`POST /v1/decisions`).

```ts
const model = useDecisionModel("openai.gpt-6-luna");
```

| Option | Default | Notes |
|--------|---------|-------|
| `openAiApiKey` | `OPENAI_API_KEY` environment variable | |
| `baseUrl` | `https://api.openai.com/v1` | Point it at an OpenAI-compatible decisions server. |
| `model` | `gpt-6-luna` | Required with `openai.decisions.v1`. |

```ts
const model = useDecisionModel("openai.decisions.v1", {
  model: "gpt-6-luna",
  baseUrl: "https://my-proxy.example.com/v1",
});
```

OpenAI is the only provider that documents [refusals](/decision/#refusals) of single questions. The other providers go through the same check, so your code doesn't need to change per provider.

## TypeSafe Jev

Calls TypeSafe's System One API (`POST /v1/systemone`).

```ts
const model = useDecisionModel("typesafe.jev");
```

| Option | Default | Notes |
|--------|---------|-------|
| `typesafeApiKey` | `TYPESAFE_API_KEY` environment variable | |
| `baseUrl` | `https://api.typesafe.ai/v1` | |
| `model` | `jev-latest` | Required with `typesafe.systemone.v1`. |

`typesafe.systemone.v1` works with any server that speaks the System One format, such as a self-hosted one:

```ts
const model = useDecisionModel("typesafe.systemone.v1", {
  model: "my-model",
  baseUrl: "https://decisions.internal.example.com/v1",
});
```

TypeSafe doesn't document a question limit. llm-exe allows up to 400, the same as OpenAI, so one set of questions works with both.

## Cloudflare Clef

Calls Clef on Cloudflare Workers AI. `cloudflare.clef-flash` is the faster Clef model.

```ts
const model = useDecisionModel("cloudflare.clef");
```

| Option | Default | Notes |
|--------|---------|-------|
| `cloudflareApiToken` | `CLOUDFLARE_API_TOKEN` environment variable | Create one in the Cloudflare dashboard (My Profile, API Tokens) with the "Workers AI" template. |
| `cloudflareAccountId` | `CLOUDFLARE_ACCOUNT_ID` environment variable | Required. It's the 32-character ID in your dashboard URL. |

Clef accepts at most 64 questions per request. Cloudflare wraps its responses in a `{ result, success, errors }` envelope. llm-exe unwraps it, so you get the same result as from any other provider.

## Score Levels on TypeSafe and Clef

TypeSafe and Clef take score levels as plain strings. A level with a description is sent as `"label: description"`:

```ts
levels: ["Minor", { label: "Critical", description: "Money lost or service down" }]
// sent as ["Minor", "Critical: Money lost or service down"]
```

Answers still use your labels (`level: "Critical"`), because llm-exe matches levels by position, not by the text the provider sends back.
