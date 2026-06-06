---
title: "llm-exe | Build Composable LLM Functions"
description: "LLM-EXE is a Typescript package for building structured, reliable AI applications. Define typed LLM functions, compose reusable executors, and integrate seamlessly with prompts, parsers, and dialogue state."
layout: home
hero:
  name: llm-exe
  # text: "Stop fighting with LLM APIs."
  tagline: Build type-safe LLM agents and AI functions with modular TypeScript components. Works with any provider, no framework lock-in.
  image:
    src: https://assets.llm-exe.com/logo.png
    alt: llm-exe
  actions:
    - theme: brand
      text: Get Started
      link: /intro/install.html
    - theme: alt
      text: See Examples
      link: /examples
    - theme: text
      text: Github
      link: https://github.com/llm-exe/llm-exe

features:
  - title: Type-Safe Everything
    details: Full TypeScript support with inferred types throughout your LLM chains. No more guessing what data you're working with.
  - title: Provider Agnostic
    details: Same code works with OpenAI, Anthropic, Google, xAI, Ollama, Bedrock, and more. Switch with one line.
  - title: Production Ready
    details: Built-in retries, timeouts, error handling, and schema validation. Battle-tested with 100% test coverage.
  - title: Composable Executors
    details: Chain executors like building blocks. Each piece does one thing well and combines naturally.
  - title: Powerful Parsers
    details: Extract exactly what you need - JSON, lists, regex, markdown blocks. Guaranteed output format or throw.
  - title: Build Smart Agents
    details: Create autonomous agents with built-in state management, tool calling, and dialogue tracking. Turn any function into an agent capability.
---

<HomeAfterIntro>

<div class="home-blocks">
<div class="home-block-left">
 <div class="home-block-title"><span class="marker-highlight">Every</span> LLM API Works Differently</div>
    <div class="home-block-description">Every LLM project starts like this: debugging JSON errors, writing boilerplate retries, juggling timeouts, and praying your parse didn’t break. It sucks.</div>
      <ul class="home-block-description-list">
  <li>JSON.parse() with fingers crossed</li>
  <li>Everything is type any</li>
  <li>Manual validation for every response</li>
  <li>All this and you only support one provider</li>
  </ul>
</div>
<div class="home-block-right">

```typescript
// Every LLM project starts like this...
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: makePrompt(data) }],
  response_format: { type: "json_object" },
});
const text = response.choices[0].message.content;
const parsed = JSON.parse(text); // 🤞 hope it's valid JSON

// Type safety? lol?
const category = parsed.category; // any
const items = parsed.items; // undefined? array? who knows

// Oh right, need to validate this somehow
if (!["bug", "feature", "question"].includes(category)) {
  // Model hallucinated a new category. Now what?
}

// TODO: Add retries
// TODO: Add tests
// TODO: Switch to Claude when this fails
```

</div>
</div>

<div class="home-blocks home-blocks-alt">
<div class="home-block-left">
 <div class="home-block-title">What if LLM Calls Were Just <span class="marker-highlight-full">Normal Functions?</span></div>
    <div class="home-block-description">What if every LLM call was as reliable as calling a regular function? <span class="marker-underline">Type-safe inputs</span>, validated outputs, built-in retries. Just async functions that happen to be powered by AI.</div>
  <ul class="home-block-description-list">
  <li><span class="marker-underline">Real TypeScript types</span>, no more any/unknown</li>
  <li>Validated outputs that match your schema</li>
  <li>Just import and call, like any other function</li>
  <li><span class="marker-highlight">One-line</span> provider switching</li>
  </ul>

</div>
<div class="home-block-right">

```typescript
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";

// Define once, use everywhere
async function llmClassifier(text: string) {
  return createLlmExecutor({
    llm: useLlm("openai.gpt-4o-mini"),
    prompt: createChatPrompt<{ text: string }>(
      "Classify this as 'bug', 'feature', or 'question': {{text}}"
    ),
    parser: createParser("stringExtract", {
      enum: ["bug", "feature", "question"],
    }),
  }).execute({ text });
}

// It's just a typed function now
const category = await llmClassifier(userInput);
// category is typed as "bug" | "feature" | "question" ✨
```

</div>
</div>

<!-- -->
<div class="home-blocks">
<div class="home-block-left">
 <div class="home-block-title">Build <span class="marker-highlight">Complex Flows</span> from Simple Parts</div>
    <div class="home-block-description">Build complex AI workflows from simple, modular functions. Each executor is <span class="marker-underline">self-contained</span>—swap models, update prompts, or change parsers without touching the rest of your code.</div>
  <ul class="home-block-description-list">
  <li>Prompt + LLM + Parser = Executor</li>
  <li>Each piece is swappable</li>
  <li>Chain them together</li>
  <li>Test them separately</li>
  </ul>

</div>
<div class="home-block-right">

```typescript
// Each piece does one thing well
const summarizer = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),
  prompt: createChatPrompt("Summarize: {{text}}"),
  parser: createParser("string"),
});

const translator = createLlmExecutor({
  llm: useLlm("anthropic.claude-sonnet-4-6"),
  prompt: createChatPrompt("Translate to {{language}}: {{text}}"),
  parser: createParser("string"),
});

// Combine them naturally
const summary = await summarizer.execute({ text: article });
const spanish = await translator.execute({
  text: summary,
  language: "Spanish",
});
```

</div>
</div>

<!-- -->
<div class="home-blocks home-blocks-alt">
<div class="home-block-left">
 <div class="home-block-title">Production-Ready <span class="marker-highlight-full">Out of the Box</span></div>
    <div class="home-block-description">No more manual retry loops. No more parsing prayers. <span class="marker-underline">Built-in error handling</span>, timeouts, and hooks. If the output doesn't match your schema, you'll know immediately.</div>
  <ul class="home-block-description-list">
  <li>Automatic retries and timeouts</li>
  <li><span class="marker-underline">Schema validation</span> that throws on mismatch</li>
  <li>Hooks for logging and monitoring</li>
  <li>Did I mention change LLM's with <span class="marker-highlight">one line</span>?</li>
  </ul>

</div>
<div class="home-block-right">

```typescript
const analyst = createLlmExecutor(
  {
    llm: useLlm("openai.gpt-4o", {
      numOfAttempts: 3,
      timeout: 30000,
    }),
    prompt: createChatPrompt<{ data: any }>(
      "Analyze this data and return insights as JSON: {{data}}"
    ),
    parser: createParser("json", {
      schema: {
        insights: { type: "array", items: { type: "string" } },
        score: { type: "number", min: 0, max: 100 },
      },
    }),
  },
  {
    hooks: {
      onSuccess: (result) => logger.info("Analysis complete", result),
      onError: (error) => logger.error("Analysis failed", error),
    },
  }
);

// Guaranteed to match schema or throw
const { insights, score } = await analyst.execute({ data: salesData });

// You can also bind events to an executor!
analyst.on("onComplete", (result) => {
  logger.info("Analysis complete", result);
});
```

</div>
</div>

<!-- -->
<div class="home-blocks">
<div class="home-block-left">
 <div class="home-block-title">Build <span class="marker-highlight">Agents</span> with Your Functions</div>
    <div class="home-block-description">Transform any function into an agent capability. Build autonomous AI agents that can use your database, APIs, and business logic—even with models that don't natively support function calling. <span class="marker-underline">You control what agents can do</span>.</div>
  <ul class="home-block-description-list">
  <li>Works with ALL models, even without native function calling</li>
  <li>The LLM plans what to do, you control execution</li>
  <li>Build agents without complex frameworks</li>
  <li>You control the execution flow and security</li>
  </ul>

</div>
<div class="home-block-right">

```typescript
import { createCallableExecutor, useExecutors } from "llm-exe";

// Your existing code becomes LLM-callable
const queryDB = createCallableExecutor({
  name: "query_database",
  description: "Query our PostgreSQL database",
  input: "SQL query to execute",
  handler: async ({ input }) => {
    const results = await db.query(input); // Your actual DB!
    return { result: results.rows };
  },
});

const sendEmail = createCallableExecutor({
  name: "send_email",
  description: "Send email via our email service",
  input: "JSON with 'to', 'subject', 'body'",
  handler: async ({ input }) => {
    const { to, subject, body } = JSON.parse(input);
    await emailService.send({ to, subject, body }); // Real emails!
    return { result: "Email sent successfully" };
  },
});

// Let the LLM use your tools
const assistant = createLlmExecutor({
  llm: useLlm("openai.gpt-4o"),
  prompt: createChatPrompt(`Help the user with their request.
You can query the database and send emails.`),
  parser: createParser("json"),
});

const tools = useExecutors([queryDB, sendEmail]);

// LLM decides what to do and calls YOUR functions
const plan = await assistant.execute({
  request: "Send our top 5 customers a thank you email",
});
// LLM might return: { action: "query_database", input: "SELECT email FROM customers ORDER BY revenue DESC LIMIT 5" }

const result = await tools.callFunction(plan.action, plan.input);
```

</div>
</div>

<!-- -->

<div class="home-blocks home-blocks-alt">
<div class="home-block-left">
 <div class="home-block-title">One-Line to Switch Providers</div>
    <!-- <div class="home-block-description">Every LLM project starts like this: debugging JSON errors, writing boilerplate retries, juggling timeouts, and praying your parse didn’t break. It sucks.</div> -->

</div>
<div class="home-block-right">

```typescript
// Change ONE line to switch providers
const llm = useLlm("openai.gpt-4o");
// const llm = useLlm("anthropic.claude-sonnet-4-6");
// const llm = useLlm("google.gemini-2.0-flash");
// const llm = useLlm("xai.grok-2");
// const llm = useLlm("ollama.llama3.3");

// Everything else stays exactly the same ✨
```

</div>
</div>

<!--

## Build a Reasoning Agent in 200 Lines

Create powerful AI agents with llm-exe's composable architecture:

- **Autonomous decision-making** with tool selection
- **Memory and state** through dialogue tracking
- **Multi-step reasoning** with execution traces
- **Provider agnostic** - works with any LLM

No complex agent frameworks. Just clean TypeScript composition.

[See Agent Examples →](/examples#reasoning-agent)
-->

## <span class="testimonials-title">Why Developers Love llm-exe</span>

<div class="testimonials-grid">
  <div class="testimonial-card">
    <div class="testimonial-quote">"Finally, LLM calls that don't feel like stringly-typed nightmares."</div>
    <div class="testimonial-author">— A Developer Really Said This</div>
  </div>
  <div class="testimonial-card">
    <div class="testimonial-quote">"Switched from OpenAI to Claude in literally one line. Everything just worked."</div>
    <div class="testimonial-author">— Tech Lead, Series B Fintech</div>
  </div>
  <div class="testimonial-card">
    <div class="testimonial-quote">"The type safety alone saved us hours of debugging. The composability changed how we build."</div>
    <div class="testimonial-author">— Principal Engineer, Fortune 500</div>
  </div>
  <div class="testimonial-card">
    <div class="testimonial-quote">"As an AI, I shouldn't play favorites... but being able to switch providers with one line means developers can always choose the best model for the job. Even if it's not me."</div>
    <div class="testimonial-author">— Claude, Anthropic</div>
  </div>
</div>

<div class="final-cta-section">
<div class="final-cta-section-inner">

  <h2>Ready to Build Something Incredible?</h2>
  <p>Stop wrestling with LLM APIs. Start shipping AI features that actually work.</p>
  <div class="cta-buttons">
    <a href="/intro/install.html" class="cta-primary">Get Started →</a>
    <a href="/examples" class="cta-secondary">Browse Examples</a>
  </div>
</div>
</div>

</HomeAfterIntro>

<style>
.home-blocks {
    display: flex;
    justify-content: start;
    align-items: center;
    padding: 60px 0;
    border-bottom: 1px solid var(--vp-c-divider-light);
    column-gap: 4rem;
}

/* Remove border on last home-blocks section */
.home-blocks:last-of-type {
    border-bottom: none;
}

/* Full width separator before CTA */
.VPDoc hr {
    margin: 80px -24px;
    border: none;
    border-top: 1px solid var(--vp-c-divider-light);
}

.home-blocks.home-blocks-alt {
    flex-direction: row-reverse;
}

.home-block-left {
    width: 40%;
}
.home-block-right {
     width: 60%;
}
.home-block-title {
  font-size: 2.125rem;
  font-weight: 800;
  margin-bottom: 20px;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

/* Centered and muted testimonials section title */
.testimonials-title {
  display: block;
  text-align: center;
  color: var(--vp-c-text-2);
  font-weight: 600;
  opacity: 0.8;
}

.home-block-description {
  color: var(--vp-c-text-2);
  font-size: 1.0625rem;
  line-height: 1.6;
}

.home-block-description-list {
    margin-top: 20px;
    color: var(--vp-c-text-2);
    padding-left: 0;
    list-style: none !important;
}

.home-block-description-list li {
    margin-bottom: 12px;
    padding-left: 24px;
    position: relative;
    font-size: 0.9375rem;
    list-style: none !important;
}

.home-block-description-list li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: var(--vp-c-brand);
    font-weight: bold;
}

/* Testimonials Section */
.testimonials-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin: 48px 0 80px 0;
}

.testimonial-card {
    background: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    padding: 28px;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 180px;
}

.testimonial-card:hover {
    border-color: var(--vp-c-brand);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
}

.testimonial-quote {
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--vp-c-text-1);
    margin-bottom: 20px;
    font-style: italic;
    flex-grow: 1;
}

.testimonial-author {
    font-size: 0.875rem;
    color: var(--vp-c-text-2);
    font-weight: 500;
    opacity: 0.8;
}

/* Final CTA Section */
.final-cta-section {
    border-top: 1px solid var(--vp-c-divider);
}

.final-cta-section-inner {
    text-align: center;
    padding: 80px 0;
    max-width: 780px;
    margin: 0 auto;
}

.final-cta-section h2 {
    font-size: 2.75rem;
    font-weight: 800;
    margin-bottom: 20px;
    line-height: 1.1;
    letter-spacing: -0.02em;
    border-top:none;
}

.final-cta-section p {
    font-size: 1.25rem;
    color: var(--vp-c-text-2);
    margin-bottom: 0;
    line-height: 1.5;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
}

.cta-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 32px;
}

.cta-primary {
    display: inline-block;
    padding: 12px 28px;
    background: #fbbf24;
    color: #18181b !important;
    text-decoration: none !important;
    border-radius: 6px;
    font-weight: 600;
    font-size: 1.0625rem;
    transition: all 0.2s ease;
    border: 1px solid transparent;
}

.cta-primary:hover {
    background: #f59e0b;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgb(251 191 36 / 0.4);
    text-decoration: none !important;
}

.cta-secondary {
    display: inline-block;
    padding: 12px 28px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1) !important;
    text-decoration: none !important;
    border-radius: 6px;
    font-weight: 600;
    font-size: 1.0625rem;
    transition: all 0.2s ease;
    border: 1px solid var(--vp-c-divider);
}

.cta-secondary:hover {
    border-color: var(--vp-c-brand);
    background: var(--vp-c-bg-soft-up);
    transform: translateY(-1px);
    text-decoration: none !important;
}

/* Dark mode adjustments */
.dark .testimonial-card {
    background: var(--vp-c-bg-elv);
}

.dark .cta-secondary {
    background: var(--vp-c-bg-elv);
}

.dark .home-blocks {
    border-bottom-color: var(--vp-c-divider);
}

/* Hero vertical centering */
.VPHero.has-image .container {
    align-items: center !important;
}

.VPHero.has-image .image {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin:0!important
}

.HomeAfterIntro {
    position: relative;
    display: block;
    padding-top: 40px;
    margin-top: 24px;
}

.VPHome {
    position: relative;
    overflow: hidden;
}


@media (max-width: 640px) {
    .VPHero .container {
        max-width: 100% !important;
        padding: 0 !important;
        overflow: visible !important;
    }

    .VPFeatures.VPHomeFeatures {
        position: static !important;
        padding-top: 30px !important;
        margin-top: 40px !important;
        clear: both !important;
    }

    .VPHero.has-image .container {
        flex-direction: column;
        align-items: flex-start !important;
        row-gap: 24px;
    }

    .VPHero.has-image .text,
    .VPHero.has-image .image {
        max-width: 100%;
        width: 100%;
        flex-grow: 0;
    }

    .VPHero.has-image .image {
        margin-top: 16px;
        margin-bottom: 32px;
        order: 2;
    }

    .VPImage.hero-code-container {
        width: 100% !important;
        max-width: none !important;
    }
}

.VPHero {
    padding-bottom: 24px;
}

/* Responsive */
@media (max-width: 960px) {
    .home-blocks {
        flex-direction: column !important;
        column-gap: 0;
        padding: 40px 0;
    }
    
    .home-blocks.home-blocks-alt {
        flex-direction: column !important;
    }
    
    .home-block-left,
    .home-block-right {
        width: 100%;
        max-width: 100%;
    }
    
    .home-block-left {
        margin-bottom: 32px;
    }
    
    .home-block-title {
        font-size: 1.75rem;
    }
    
    .home-block-description {
        font-size: 1rem;
    }
    
    .home-block-description-list {
        font-size: 0.875rem;
    }
}

@media (max-width: 639px) {
    /* Override VitePress mobile defaults for features */
  div.VPFeatures.VPHomeFeatures {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        padding:0;
    }
   /*    
    div.VPFeatures.VPHomeFeatures > div.VPFeature {
        width: auto !important;
        max-width: 100% !important;
    } */

     div.VPFeatures.VPHomeFeatures {
      display:block!important;
     }
     div.VPFeatures.VPHomeFeatures .container {
      padding-left:0!important;
      padding-right:0!important;
     }
     .VPFeatures.VPHomeFeatures .items {
      padding-left:0!important;
      padding-right:0!important;
     }
}

@media (max-width: 768px) {
    /* Target the actual items container that holds the cards */
    .VPFeatures.VPHomeFeatures .items {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        /* gap: 12px !important; */
        padding: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
    }
    
    /* Make each feature card fill its grid cell */
    /* .VPFeatures.VPHomeFeatures .item {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
    } */
    
    .VPFeatures.VPHomeFeatures .VPFeature {
        width: 100% !important;
        padding: 18px 12px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        background: var(--vp-c-bg-soft) !important;
        border: 1px solid var(--vp-c-divider) !important;
        border-radius: 8px !important;
        min-height: 120px !important;
    }
    
    .VPFeature article {
        padding: 0 !important;
        margin: 0 !important;
    }
    
    .VPFeature h2 {
        font-size: 1rem !important;
        margin: 0 0 2 0 !important;
        line-height: 1.3 !important;
        font-weight: 700 !important;
    }
    
    .VPFeature p {
        font-size: 0.875rem !important;
        line-height: 1.4 !important;
        margin: 0 !important;
        color: var(--vp-c-text-2) !important;
    }
    
    .testimonials-grid {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .testimonial-card {
        min-height: auto;
    }
    
    .final-cta-section h2 {
        font-size: 2rem;
    }
    
    .final-cta-section p {
        font-size: 1.125rem;
    }
    
    .cta-buttons {
        flex-direction: column;
        align-items: center;
    }
    
    .cta-primary, .cta-secondary {
        width: 100%;
        max-width: 300px;
        text-align: center;
    }
    
    .home-blocks {
        padding: 32px 0;
    }
    
    .home-block-title {
        font-size: 1.5rem;
        margin-bottom: 16px;
    }
    
    .home-block-left {
        margin-bottom: 24px;
    }
    
    /* Code blocks in mobile */
    .home-block-right pre {
        overflow-x: auto;
        font-size: 0.875rem;
    }
    
    .home-block-right .language-typescript {
        margin: 0;
    }
}

@media (max-width: 480px) {
    
    .home-blocks {
        padding: 24px 0;
    }
    
    .home-block-title {
        font-size: 1.375rem;
    }
    
    .home-block-description {
        font-size: 0.9375rem;
    }
    
    .home-block-description-list {
        font-size: 0.8125rem;
        padding-left: 20px;
    }
    
    .home-block-description-list li {
        padding-left: 20px;
    }
    
    .home-block-right pre {
        font-size: 0.8125rem;
    }
}
</style>
