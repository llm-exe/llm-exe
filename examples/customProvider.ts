// #region file
// #region imports
import {
  useLlmConfiguration,
  createOpenAiCompatibleConfiguration,
  createChatPrompt,
  createParser,
  createLlmExecutor,
} from "llm-exe";
// #endregion imports

// #region openai-compatible
/**
 * Example: OpenAI-Compatible Local Model
 * Use this pattern for local model servers that provide OpenAI-compatible endpoints
 */
export function createOpenAICompatibleProvider() {
  // Use the built-in helper - handles prompt sanitization and response transformation
  return useLlmConfiguration(
    createOpenAiCompatibleConfiguration({
      key: "local-openai-compatible",
      provider: "local.openai",
      endpoint: "http://localhost:11434/v1/chat/completions",
      apiKeyMapping: ["apiKey", ""], // No API key needed for local
    })
  );
}

export async function localModelExample(text: string) {
  const localLlm = createOpenAICompatibleProvider();
  
  const executor = createLlmExecutor({
    llm: localLlm({ model: "llama-3.3-70b" }),
    prompt: createChatPrompt<{ text: string }>(`
      Summarize the following text in one sentence:
      {{text}}
    `),
    parser: createParser("string"),
  });
  
  return executor.execute({ text });
}
// #endregion openai-compatible

// #region corporate-proxy
/**
 * Example: Corporate Proxy Configuration
 * Route requests through a corporate proxy with custom headers
 */
export function createProxiedProvider() {
  return useLlmConfiguration({
    key: "proxied-openai",
    provider: "openai.chat",
    endpoint: "https://proxy.company.com/openai/v1/chat/completions",
    method: "POST",
    headers: JSON.stringify({
      "Authorization": "Bearer {{openAiApiKey}}",
      "X-Company-Auth": "{{companyToken}}",
      "X-Department": "Engineering",
      "Content-Type": "application/json"
    }),
    
    options: {
      openAiApiKey: {
        default: () => process.env.OPENAI_API_KEY || "",
        required: [true, "OpenAI API key is required"],
      },
      companyToken: {
        default: () => process.env.COMPANY_PROXY_TOKEN || "",
        required: [true, "Company proxy token is required"],
      },
      model: {
        default: "gpt-6-luna",
      },
      temperature: {
        default: 0.7,
      },
    },
    
    mapBody: {
      prompt: {
        key: "messages",
        transform: (messages: any) => {
          // Simple sanitization for OpenAI format
          if (Array.isArray(messages)) {
            return messages.map((m: any) => ({
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
      temperature: {
        key: "temperature",
      },
    },
    
    // OpenAI-compatible response transformer
    transformResponse: (result: any) => ({
      id: result.id || `proxy-${Date.now()}`,
      name: result.model || "proxy-model",
      created: result.created || Date.now(),
      usage: result.usage || {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
      content: result.choices?.[0]?.message?.content
        ? [{ type: "text" as const, text: result.choices[0].message.content }]
        : [{ type: "text" as const, text: "" }],
      stopReason: result.choices?.[0]?.finish_reason || "stop",
    }),
  } as any);
}

export async function proxiedExample(question: string) {
  const proxiedLlm = createProxiedProvider();
  
  const executor = createLlmExecutor({
    llm: proxiedLlm({
      openAiApiKey: process.env.OPENAI_API_KEY,
      companyToken: process.env.COMPANY_PROXY_TOKEN,
    } as any),
    prompt: createChatPrompt<{ question: string }>(`
      Answer this question concisely: {{question}}
    `),
    parser: createParser("string"),
  });
  
  return executor.execute({ question });
}
// #endregion corporate-proxy

// #region custom-api
/**
 * Example: Custom API with Different Format
 * For APIs that don't follow OpenAI/Anthropic conventions
 */
export function createCustomApiProvider() {
  return useLlmConfiguration({
    key: "custom-api",
    provider: "openai.chat", // Use as base for type compatibility
    endpoint: "https://api.custom-llm.com/generate",
    method: "POST",
    headers: JSON.stringify({
      "X-API-Key": "{{apiKey}}",
      "Content-Type": "application/json"
    }),
    
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
        transform: (messages: any) => {
          // Convert chat messages to single string
          if (Array.isArray(messages)) {
            return messages
              .map((m: any) => `${m.role}: ${m.content}`)
              .join("\n");
          }
          return messages;
        },
      },
      maxLength: {
        key: "max_tokens",
      },
    },
    
    transformResponse: (result: any) => {
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
            type: "text" as const,
            text: result.generated_text || "",
          },
        ],
        stopReason: result.stop_reason || "stop",
      };
    },
  } as any);
}

export async function customApiExample(input: string) {
  const customLlm = createCustomApiProvider();
  
  const executor = createLlmExecutor({
    llm: customLlm({
      apiKey: process.env.CUSTOM_API_KEY || "test-key",
    } as any),
    prompt: createChatPrompt<{ input: string }>(`Process this: {{input}}`),
    parser: createParser("string"),
  });
  
  return executor.execute({ input });
}
// #endregion custom-api

// #region mock-testing
/**
 * Example: Mock Provider for Testing
 * Create predictable responses for unit tests
 */
export function createMockProvider(mockResponse: string = "Mock response") {
  return useLlmConfiguration({
    key: "mock-test",
    provider: "openai.chat",
    endpoint: "https://mock.local/chat",
    method: "POST",
    headers: JSON.stringify({}),
    
    options: {},
    
    mapBody: {
      prompt: {
        key: "messages",
      },
    },
    
    // Always return the mock response
    transformResponse: (_result: any) => ({
      id: "mock-" + Date.now(),
      name: "mock-model",
      created: Date.now(),
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
      content: [
        {
          type: "text" as const,
          text: mockResponse,
        },
      ],
      stopReason: "stop" as const,
    }),
  } as any);
}

export async function mockExample() {
  const mockLlm = createMockProvider("This is a test response");
  
  const executor = createLlmExecutor({
    llm: mockLlm({}),
    prompt: createChatPrompt(`Test prompt`),
    parser: createParser("string"),
  });
  
  return executor.execute({});
}
// #endregion mock-testing
// #endregion file