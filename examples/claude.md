# claude.md - llm-exe Project Development Guide

## Project Overview

You are working on llm-exe, a TypeScript-first toolkit for building structured, type-safe LLM-powered applications. The project follows a modular architecture with four core components: **LLM** (provider abstraction), **Prompt** (Handlebars templating), **Parser** (output validation), and **Executor** (orchestration).

Core philosophy: "Make LLM calls feel like regular functions" with full type safety from input to output.

## Architecture Principles

### Component Separation

Always maintain clear boundaries between:

- **Prompts**: Template logic only, no business logic
- **Parsers**: Output validation and type coercion only
- **Executors**: Orchestration only, no direct LLM interaction
- **LLM**: Provider calls only, no parsing or templating

### Type Safety First

```typescript
// ALWAYS use typed interfaces
const prompt = createChatPrompt<{ query: string; context: string }>(`...`);
const parser = createParser("json", { schema: outputSchema });
const executor = createLlmExecutor({ llm, prompt, parser });
// Result: (input: InputType) => Promise<OutputType>
```

### Provider Agnosticism

```typescript
// Design for easy provider switching
const llm = useLlm("openai.gpt-4o-mini");
// const llm = useLlm("anthropic.claude-sonnet-4-6");
// Code should work identically with any provider
```

## Code Generation Guidelines

### Executor Pattern

When creating executors:

```typescript
// ✅ GOOD: Clear, single responsibility
const classifyExecutor = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),
  prompt: createChatPrompt<{ text: string; categories: string[] }>(`
    Classify the following text into one of these categories:
    {{#each categories}}- {{this}}{{/each}}
    
    Text: {{text}}
  `),
  parser: createParser("stringExtract", { enum: categories }),
});

// ❌ BAD: Mixed concerns
// Don't combine multiple unrelated tasks in one executor
```

### Prompt Templates

Use Handlebars features effectively:

```typescript
// ✅ GOOD: Typed, dynamic, reusable
const prompt = createChatPrompt<{ items: Item[]; config: Config }>(`
  {{#if config.detailed}}
    Provide detailed analysis for:
  {{else}}
    Summarize:
  {{/if}}
  
  {{#each items}}
    - {{this.name}}: {{this.description}}
  {{/each}}
`);

// ❌ BAD: String concatenation
// const prompt = "Analyze: " + items.join(", ");
```

### Parser Selection

Choose the right parser for the output:

```typescript
// JSON with schema validation (uses JSON Schema via defineSchema)
const schema = defineSchema({
  type: "object",
  properties: {
    result: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["result", "confidence"],
} as const);
const jsonParser = createParser("json", { schema });

// Enum extraction
const enumParser = createParser("stringExtract", {
  enum: ["positive", "negative", "neutral"],
});

// Custom parser for complex logic
const customParser = createCustomParser("customParser", (input: string) => {
  // Validation and transformation logic
  return parsedResult;
});
```

## Testing Patterns

### Non-Deterministic Output Testing

LLMs are non-deterministic even with temperature=0:

```typescript
// ✅ GOOD: Semantic testing
describe("executor", () => {
  it("should classify sentiment correctly", async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(await executor.execute({ text: "Great product!" }));
    }

    // Test properties, not exact values
    expect(results.every((r) => ["positive", "neutral"].includes(r))).toBe(
      true
    );
    expect(results.filter((r) => r === "positive").length).toBeGreaterThan(1);
  });
});

// ❌ BAD: Exact output matching
// expect(result).toBe("positive"); // Will fail intermittently
```

### Mock Testing

```typescript
// Use the built-in mock provider
const llm = useLlm("openai.chat-mock.v1");
// Configure mock responses for deterministic testing
```

### Component Isolation

Test each component separately:

```typescript
// Test prompt generation
const prompt = createChatPrompt<{ name: string }>(`Hello {{name}}`);
expect(prompt.format({ name: "World" })).toContain("Hello World");

// Test parser logic
const parser = createParser("json", { schema });
expect(parser.parse('{"valid": "json"}')).toEqual({ valid: "json" });

// Test executor composition with mocks
```

## Error Handling

### Graceful Degradation

```typescript
const executor = createLlmExecutor(
  {
    llm,
    prompt,
    parser,
  },
  {
    maxRetries: 3,
    timeout: 30000,
    hooks: {
      onError: (error) => {
        logger.error("Executor failed", {
          error: error.message,
          context: error.context,
        });
        // Implement fallback logic
      },
    },
  }
);
```

### Parser Validation

Always handle parser failures:

```typescript
try {
  const result = await executor.execute(input);
  return result;
} catch (error) {
  if (error.name === "ParserError") {
    // Handle malformed LLM output
    logger.warn("LLM output failed parsing", { raw: error.raw });
    return fallbackValue;
  }
  throw error;
}
```

## Performance Optimization

### Executor Reuse

```typescript
// ✅ GOOD: Create once, use many times
const sharedExecutor = createLlmExecutor({ llm, prompt, parser });

// ❌ BAD: Creating new executor for each call
// function processItem(item) {
//   const executor = createLlmExecutor(...); // Wasteful
// }
```

### Parallel Execution

```typescript
// Process multiple items efficiently
const results = await Promise.all(
  items.map((item) => executor.execute({ input: item }))
);
```

### Provider Selection

```typescript
// Use appropriate models for tasks
const llm =
  complexity === "high"
    ? useLlm("openai.gpt-4o")
    : useLlm("openai.gpt-4o-mini");
```

## Security Patterns

### Input Validation

```typescript
// Always validate inputs before passing to prompts
const validateInput = (input: unknown): ValidInput => {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }
  return parsed.data;
};

const executor = createLlmExecutor({
  llm,
  prompt,
  parser,
  // Add validation layer
  preProcess: validateInput,
});
```

### Prompt Injection Prevention

```typescript
// ✅ GOOD: Use Handlebars escaping
const prompt = createChatPrompt<{ userInput: string }>(`
  Analyze this text: {{userInput}}
`); // Automatically escaped

// ❌ BAD: Direct interpolation
// const prompt = `Analyze: ${userInput}`; // Vulnerable
```

## Common Anti-Patterns to Avoid

1. **String Manipulation Instead of Templates**

   ```typescript
   // ❌ BAD
   const prompt = "Question: " + question + "\nContext: " + context;

   // ✅ GOOD
   const prompt = createChatPrompt<{ question: string; context: string }>(`
     Question: {{question}}
     Context: {{context}}
   `);
   ```

2. **Ignoring Types**

   ```typescript
   // ❌ BAD
   const executor = createLlmExecutor({ llm, prompt, parser }) as any;

   // ✅ GOOD - Let TypeScript infer types
   const executor = createLlmExecutor({ llm, prompt, parser });
   ```

3. **Provider-Specific Logic**

   ```typescript
   // ❌ BAD
   if (provider === "openai") {
     // OpenAI-specific code
   }

   // ✅ GOOD - Use provider-agnostic patterns
   const llm = useLlm(provider);
   ```

4. **Mixing Concerns**

   ```typescript
   // ❌ BAD - Parser doing prompt work
   const parser = {
     parse: (input) => {
       // Also modifying the prompt...
     },
   };

   // ✅ GOOD - Clear separation
   const parser = createParser("json", { schema });
   ```

## Development Workflow

### 1. Start Simple

```typescript
// Begin with basic executor
const simple = createLlmExecutor({
  llm: useLlm("openai.gpt-4o-mini"),
  prompt: createChatPrompt(`Summarize: {{text}}`),
  parser: createParser("string"),
});

// Then compose complexity
```

### 2. Iterate with Types

- Define input types first
- Let parser define output types
- Use TypeScript to catch integration issues

### 3. Test Incrementally

- Test prompt formatting
- Test parser validation
- Test executor with mocks
- Test with real LLM calls

## Project-Specific Conventions

### Naming

- Executors: `[action]Executor` (e.g., `classifyExecutor`, `summarizeExecutor`)
- Prompts: `[action]Prompt`
- Parsers: `[output]Parser` (e.g., `jsonParser`, `listParser`)

### File Organization

```
/src/
  /executors/     # Composed executors
  /prompts/       # Reusable prompt templates
  /parsers/       # Custom parsers
  /utils/         # Shared utilities
```

### Documentation

Always document:

- Expected input/output types
- Provider requirements (if any)
- Error scenarios and handling
- Performance characteristics

## Hook Usage

Leverage hooks for cross-cutting concerns:

```typescript
const executor = createLlmExecutor(
  {
    llm,
    prompt,
    parser,
  },
  {
    hooks: {
      onStart: ({ input }) => logger.info("Starting", { input }),
      onSuccess: ({ output, usage }) => {
        metrics.record({ tokens: usage.totalTokens });
        logger.info("Success", { output });
      },
      onError: ({ error }) => {
        logger.error("Failed", { error });
        alerting.notify({ error });
      },
    },
  }
);
```

## Remember

- llm-exe makes LLM calls feel like typed functions
- Always maintain component separation
- Test for properties, not exact outputs
- Use TypeScript's type system fully
- Design for provider switching from day one
- Handle non-deterministic behavior gracefully

When in doubt, follow the pattern: **Prompt → LLM → Parser → Typed Result**
