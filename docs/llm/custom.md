# Custom Provider Configuration

The `useLlmConfiguration` function allows you to define custom LLM provider configurations. This is useful for:

- Using OpenAI-compatible APIs (local models, third-party providers)
- Working behind corporate proxies
- Testing with mock servers
- Supporting new providers before they're officially added

## Basic Usage

```typescript
import { useLlmConfiguration } from "llm-exe";

const customLlm = useLlmConfiguration({
  key: "my-custom-provider",
  provider: "openai.chat",
  endpoint: "https://api.mycompany.com/v1/chat/completions",
  method: "POST",
  headers: `{"Authorization": "Bearer {{apiKey}}", "Content-Type": "application/json"}`,
  
  // Define available options and their defaults
  options: {
    apiKey: {
      required: [true, "API key is required"],
    },
    model: {
      default: "gpt-4o-mini",
    },
    temperature: {
      default: 0.7,
    },
  },
  
  // Map options to request body
  mapBody: {
    prompt: {
      key: "messages",
      transform: (messages) => messages, // Pass through
    },
    model: {
      key: "model",
    },
    temperature: {
      key: "temperature",
    },
  },
  
  // Transform the response to standard format
  transformResponse: (result) => ({
    id: result.id || `custom-${Date.now()}`,
    name: result.model || "custom-model",
    created: result.created || Date.now(),
    usage: result.usage || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
    content: result.choices?.[0]?.message?.content
      ? [{ type: "text", text: result.choices[0].message.content }]
      : [{ type: "text", text: "" }],
    stopReason: result.choices?.[0]?.finish_reason || "stop",
  }),
});

// Use it like any other LLM
const llm = customLlm({
  apiKey: process.env.CUSTOM_API_KEY,
  model: "gpt-4o",
} as any); // Note: Use 'as any' for custom options that aren't in base types

const response = await llm.call("Hello, how are you?");
console.log(response.getResultText());
```

## Examples

### OpenAI-Compatible Local Model

Many local model servers (Ollama, LM Studio, etc.) provide OpenAI-compatible endpoints. Use the built-in helper for these:

```typescript
import { useLlmConfiguration, createOpenAiCompatibleConfiguration } from "llm-exe";

// Simple and correct - includes prompt sanitization and response handling
const localLlm = useLlmConfiguration(
  createOpenAiCompatibleConfiguration({
    key: "local-llama",
    provider: "local.llama",
    endpoint: "http://localhost:11434/v1/chat/completions",
    apiKeyMapping: ["apiKey", "LOCAL_API_KEY"], // or ["apiKey", ""] if no key needed
  })
);

const llm = localLlm({ model: "llama-3.3-70b" });
const response = await llm.call("Explain quantum computing");
```

Or if you need to customize further:

```typescript
const localLlm = useLlmConfiguration({
  ...createOpenAiCompatibleConfiguration({
    key: "local-custom",
    provider: "local.custom",
    endpoint: "http://localhost:8080/v1/chat/completions",
    apiKeyMapping: ["apiKey", ""],
  }),
  // Override specific options if needed
  options: {
    model: {
      default: "mixtral-8x7b",
    },
    temperature: {
      default: 0.7,
    },
  },
});
```

### Corporate Proxy

Route requests through a corporate proxy with custom headers:

```typescript
const proxiedLlm = useLlmConfiguration({
  key: "proxied-openai",
  provider: "openai.chat",
  endpoint: "https://proxy.company.com/openai/v1/chat/completions",
  method: "POST",
  headers: `{
    "Authorization": "Bearer {{openAiApiKey}}",
    "X-Company-Auth": "{{companyToken}}",
    "X-Trace-Id": "{{traceId}}",
    "Content-Type": "application/json"
  }`,
  
  options: {
    openAiApiKey: {
      default: () => process.env.OPENAI_API_KEY,
    },
    companyToken: {
      default: () => process.env.COMPANY_TOKEN,
      required: [true, "Company token is required for proxy"],
    },
    traceId: {
      default: () => crypto.randomUUID(),
    },
    model: {
      default: "gpt-4o-mini",
    },
  },
  
  mapBody: {
    prompt: {
      key: "messages",
      transform: (messages) => {
        // Ensure messages are in OpenAI format
        if (Array.isArray(messages)) {
          return messages.map(m => ({
            role: m.role || "user",
            content: m.content || ""
          }));
        }
        return messages;
      },
    },
    model: {
      key: "model",
    },
  },
  
  transformResponse: (result) => ({
    id: result.id || `proxy-${Date.now()}`,
    name: result.model || "proxy-model",
    created: result.created || Date.now(),
    usage: result.usage || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
    content: result.choices?.[0]?.message?.content
      ? [{ type: "text", text: result.choices[0].message.content }]
      : [{ type: "text", text: "" }],
    stopReason: result.choices?.[0]?.finish_reason || "stop",
  }),
});
```

### Custom API with Different Format

For APIs that don't follow OpenAI/Anthropic conventions:

```typescript
const customApi = useLlmConfiguration({
  key: "custom-api",
  provider: "openai.chat", // Use as base for type compatibility
  endpoint: "https://api.custom-llm.com/generate",
  method: "POST",
  headers: `{
    "X-API-Key": "{{apiKey}}",
    "Content-Type": "application/json"
  }`,
  
  options: {
    apiKey: {
      required: [true, "API key is required"],
    },
    maxLength: {
      default: 1000,
    },
  },
  
  mapBody: {
    prompt: {
      key: "input_text",
      transform: (messages) => {
        // Convert chat messages to single string
        if (Array.isArray(messages)) {
          return messages
            .map(m => `${m.role}: ${m.content}`)
            .join("\n");
        }
        return messages;
      },
    },
    maxLength: {
      key: "max_tokens",
    },
  },
  
  transformResponse: (result) => {
    // Map custom response format to standard format
    return {
      id: result.request_id || "custom-" + Date.now(),
      name: "custom-model",
      created: Date.now(),
      usage: {
        input_tokens: result.stats?.input_tokens || 0,
        output_tokens: result.stats?.output_tokens || 0,
        total_tokens: result.stats?.total_tokens || 0,
      },
      content: [
        {
          type: "text",
          text: result.generated_text || "",
        },
      ],
      stopReason: result.stop_reason || "stop",
    };
  },
});
```

## OpenAI-Compatible APIs

### createOpenAiCompatibleConfiguration

For OpenAI-compatible endpoints, use the built-in `createOpenAiCompatibleConfiguration` helper to avoid boilerplate. This is perfect for services like Ollama, LM Studio, Together AI, and any other OpenAI-compatible API.

```typescript
import { useLlmConfiguration, createOpenAiCompatibleConfiguration } from "llm-exe";

const config = createOpenAiCompatibleConfiguration({
  key: "my-provider",           // Unique identifier
  provider: "my-provider.chat",  // Provider name  
  endpoint: "https://api.example.com/v1/chat/completions",
  apiKeyMapping: ["apiKey", "MY_API_KEY_ENV"]  // [option name, env var]
});

const llm = useLlmConfiguration(config);
```

#### Parameters

- **key** (string): Unique identifier for this configuration
- **provider** (string): Provider identifier (e.g., "local.ollama", "custom.service")
- **endpoint** (string): Full URL to the OpenAI-compatible `/chat/completions` endpoint
- **apiKeyMapping** ([string, string]): Tuple of `[optionName, envVarName]`
  - First element: the option name users will use (e.g., `apiKey`)
  - Second element: environment variable to read from (or empty string if no default)
- **transformResponse** (optional): Custom response transformer (defaults to OpenAI format)

#### What's Included

This helper automatically provides:
- Proper prompt sanitization for OpenAI format
- Response transformation to standard format
- Function calling support
- JSON schema support
- Proper Authorization and Content-Type headers
- All required parameter mappings (model, temperature, top_p, etc.)

#### Examples

**Local Ollama Server:**
```typescript
const ollamaConfig = createOpenAiCompatibleConfiguration({
  key: "ollama-local",
  provider: "ollama.local",
  endpoint: "http://localhost:11434/v1/chat/completions",
  apiKeyMapping: ["apiKey", ""] // No API key needed
});

const ollama = useLlmConfiguration(ollamaConfig);
const llm = ollama({ model: "llama3.3:70b" });
```

**Together AI:**
```typescript
const togetherConfig = createOpenAiCompatibleConfiguration({
  key: "together-ai",
  provider: "together.ai",
  endpoint: "https://api.together.xyz/v1/chat/completions",
  apiKeyMapping: ["apiKey", "TOGETHER_API_KEY"]
});

const together = useLlmConfiguration(togetherConfig);
const llm = together({ 
  apiKey: process.env.TOGETHER_API_KEY,
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo"
});
```

**Extending the Configuration:**
```typescript
const baseConfig = createOpenAiCompatibleConfiguration({
  key: "custom",
  provider: "custom.service",
  endpoint: "https://api.custom.com/v1/chat/completions",
  apiKeyMapping: ["apiKey", "CUSTOM_API_KEY"]
});

// Add or override options
const extendedConfig = {
  ...baseConfig,
  options: {
    ...baseConfig.options,
    maxTokens: { default: 2048 }
  },
  mapBody: {
    ...baseConfig.mapBody,
    maxTokens: { key: "max_tokens" }
  }
};

const custom = useLlmConfiguration(extendedConfig);
```

## Configuration Reference

### Config Object Properties

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Unique identifier for this configuration |
| `provider` | `string` | Base provider type (e.g., "openai.chat") |
| `endpoint` | `string` | API endpoint URL (supports `{{variable}}` templates) |
| `method` | `"POST" \| "GET" \| "PUT"` | HTTP method |
| `headers` | `string` | JSON string of headers (supports `{{variable}}` templates) |
| `options` | `object` | Available parameters and their defaults/requirements |
| `mapBody` | `object` | Maps parameters to request body fields |
| `mapOptions?` | `object` | Maps executor options (functions, schemas) to provider format |
| `transformResponse` | `function` | Transforms provider response to standard format |

### Options Configuration

Each option can have:
- `default`: Default value or function that returns the value
- `required`: `[boolean, string]` tuple for required fields with error message

### MapBody Configuration

Each mapping can have:
- `key`: Target field name in request body (supports dot notation)
- `default`: Default value if not provided
- `transform`: Function to transform the value before sending

### Response Transform Function

The `transformResponse` function must return an object with this structure:

```typescript
{
  id: string;
  name: string;
  created: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  content: Array<{
    type: "text";
    text: string;
  }>;
  stopReason: string;
}
```

## Use with Executors

Custom providers work seamlessly with executors:

```typescript
import { useLlmConfiguration, createLlmExecutor, createChatPrompt, createParser } from "llm-exe";

const customLlm = useLlmConfiguration({
  // ... your config
});

const executor = createLlmExecutor({
  llm: customLlm({ apiKey: process.env.API_KEY } as any),
  prompt: createChatPrompt(`Analyze: {{text}}`),
  parser: createParser("json"),
});

const result = await executor.execute({ text: "..." });
```

## Testing

Use custom configurations to create mock providers for testing:

```typescript
const mockLlm = useLlmConfiguration({
  key: "test-mock",
  provider: "openai.chat",
  endpoint: "http://localhost:3000/mock",
  method: "POST",
  headers: `{}`,
  
  options: {},
  mapBody: {
    prompt: { key: "messages" },
  },
  
  transformResponse: (result) => ({
    id: "test-1",
    name: "mock",
    created: Date.now(),
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    content: [{ type: "text", text: result.response || "Mock response" }],
    stopReason: "stop",
  }),
});
```

## Important Notes

1. **Custom options require type assertion**: When passing custom options that aren't in the base types, use `as any`:
   ```typescript
   const llm = customLlm({ customOption: "value" } as any);
   ```

2. **Transform functions are required**: You must implement your own `transformResponse` function to map the provider's response format to llm-exe's standard format.

3. **Headers must be valid JSON**: The `headers` property expects a JSON string, not an object.

4. **Template variables**: Both `endpoint` and `headers` support `{{variable}}` placeholders that will be replaced with values from the options.