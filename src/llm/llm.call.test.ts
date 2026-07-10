import { apiRequest } from "@/utils/modules/request";
import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import {
  GenericLLm,
  IChatMessages,
  LlmProvider,
  LlmProviderKey,
  LlmExecutorWithFunctionsOptions,
  GenericFunctionCall,
} from "@/types";
import { getLlmConfig } from "@/llm/config";
import { mapBody } from "@/llm/_utils.mapBody";
import { parseHeaders } from "@/llm/_utils.parseHeaders";
import { useLlm_call } from "@/llm/llm.call";
import { LlmExeError } from "@/errors";
import { cleanJsonSchemaFor } from "./output/_utils/cleanJsonSchemaFor";
import { BaseLlmOutput } from "./output/base";
import { OutputDefault } from "./output/default";
import { anthropic } from "./config/anthropic";
import { google } from "./config/google";
import { createOpenAiCompatibleConfiguration } from "./config/openai/compatible";

jest.mock("@/utils/modules/request", () => ({
  apiRequest: jest.fn(),
}));

jest.mock("@/utils/modules/replaceTemplateStringSimple", () => ({
  replaceTemplateStringSimple: jest.fn(),
}));

jest.mock("@/llm/_utils.mapBody", () => ({
  mapBody: jest.fn(),
}));

jest.mock("@/llm/_utils.parseHeaders", () => ({
  parseHeaders: jest.fn(),
}));

jest.mock("@/llm/output/base", () => ({
  BaseLlmOutput: jest.fn(),
}));

jest.mock("@/llm/config", () => ({
  getLlmConfig: jest.fn(),
}));

jest.mock("@/llm/output/default", () => ({
  OutputDefault: jest.fn(),
}));

describe("useLlm_call", () => {
  const getLlmConfigMock = getLlmConfig as jest.Mock;
  const replaceTemplateStringSimpleMock =
    replaceTemplateStringSimple as jest.Mock;
  const mapBodyMock = mapBody as jest.Mock;
  const parseHeadersMock = parseHeaders as jest.Mock;
  const apiRequestMock = apiRequest as jest.Mock;
  const BaseLlmOutputMock = BaseLlmOutput as jest.Mock;
  const OutputDefaultMock = OutputDefault as jest.Mock;

  const mockState = {
    key: "openai.chat-mock.v1",
    provider: "openai.chat-mock",
  } as unknown as GenericLLm & {
    key: LlmProviderKey;
    provider: LlmProvider;
  };

  const mockStateAnthropic = {
    key: "anthropic.chat.v1",
    provider: "anthropic.chat",
  } as unknown as GenericLLm & {
    key: LlmProviderKey;
    provider: LlmProvider;
  };

  const mockStateOpenAi = {
    key: "openai.chat.v1",
    provider: "openai.chat",
  } as unknown as GenericLLm & {
    key: LlmProviderKey;
    provider: LlmProvider;
  };

  const mockMessages = [
    {
      role: "user",
      content: "Hello",
    },
  ] as IChatMessages;
  const mockOptions = {} as LlmExecutorWithFunctionsOptions;

  // Create mock configs for different providers
  const mockOpenAiConfig = {
    ...createOpenAiCompatibleConfiguration({
      key: "openai.chat.v1",
      provider: "openai.chat",
      endpoint: "http://api.test/endpoint",
      apiKeyMapping: ["openAiApiKey", "OPENAI_API_KEY"],
      transformResponse: jest.fn(),
    }),
    mapBody: jest.fn(),
    transformResponse: jest.fn(),
  };

  const mockAnthropicConfig = {
    ...anthropic["anthropic.chat.v1"],
    endpoint: "http://api.test/endpoint",
    mapBody: jest.fn(),
    transformResponse: jest.fn(),
  };

  const mockGoogleConfig = {
    ...google["google.chat.v1"],
    endpoint: "http://api.test/endpoint",
    mapBody: jest.fn(),
    transformResponse: jest.fn(),
  };

  // Variable to hold the current mock config for tests
  let mockConfig = mockOpenAiConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Return different configs based on the provider key
    getLlmConfigMock.mockImplementation((key) => {
      if (key === "anthropic.chat.v1") {
        return mockAnthropicConfig;
      } else if (key === "google.chat.v1") {
        return mockGoogleConfig;
      } else if (key === "deepseek.chat.v1") {
        // DeepSeek uses OpenAI-compatible config
        return {
          ...mockOpenAiConfig,
          provider: "deepseek.chat",
        };
      } else if (key === "xai.chat.v1") {
        // xAI uses OpenAI-compatible config
        return {
          ...mockOpenAiConfig,
          provider: "xai.chat",
        };
      } else if (key === "openai.chat.v1" || key === "openai.chat-mock.v1") {
        // Return OpenAI config for OpenAI providers
        return mockOpenAiConfig;
      }
      // For unknown providers, return config without mapOptions
      return {
        ...mockOpenAiConfig,
        mapOptions: undefined,
      };
    });

    replaceTemplateStringSimpleMock.mockReturnValue("http://api.test/endpoint");
    mapBodyMock.mockReturnValue({
      prompt: mockMessages,
    });
    parseHeadersMock.mockResolvedValue({
      "Content-Type": "application/json",
    });
    apiRequestMock.mockResolvedValue({
      data: { data: "response" },
      headers: {},
    });
  });

  it("should call all necessary functions and return parsed output", async () => {
    const mockOutputResult = { content: [], usage: {}, stopReason: "stop" };
    mockConfig.transformResponse.mockReturnValueOnce(mockOutputResult);
    const mockBaseLlmOutputReturn = "parsedOutput";
    BaseLlmOutputMock.mockReturnValueOnce(mockBaseLlmOutputReturn);

    const result = await useLlm_call(mockState, mockMessages, mockOptions);

    expect(getLlmConfig).toHaveBeenCalledWith(mockState.key);
    expect(mapBody).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      prompt: mockMessages,
    });
    expect(replaceTemplateStringSimple).toHaveBeenCalledWith(
      mockConfig.endpoint,
      mockState
    );
    expect(parseHeaders).toHaveBeenCalledWith(
      mockConfig,
      mockState,
      expect.objectContaining({
        url: "http://api.test/endpoint",
        body: JSON.stringify({
          prompt: mockMessages,
        }),
      })
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "http://api.test/endpoint",
      expect.objectContaining({
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
    expect(mockConfig.transformResponse).toHaveBeenCalledWith(
      {
        data: "response",
      },
      mockConfig,
      {}
    );
    expect(BaseLlmOutput).toHaveBeenCalledWith(mockOutputResult);

    expect(result).toBe(mockBaseLlmOutputReturn);
  });

  it("should handle an error in apiRequest", async () => {
    parseHeadersMock.mockImplementationOnce(() => {
      throw new Error("API Request Failed");
    });

    await expect(
      useLlm_call(mockState, mockMessages, mockOptions)
    ).rejects.toThrow("API Request Failed");
  });

  it("should handle anthropic with functionCall 'none' by clearing functions", async () => {
    const mock_options = {
      functionCall: "none",
      functions: [{ name: "something", description: "", parameters: {} }],
    };
    await useLlm_call(mockStateAnthropic, mockMessages, mock_options as any);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "http://api.test/endpoint",
      expect.objectContaining({
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("should handle anthropic with functionCall 'auto' and set tool_choice", async () => {
    const mock_options = {
      functionCall: "auto" as GenericFunctionCall,
      functions: [{ name: "something", description: "", parameters: {} }],
    };
    await useLlm_call(mockStateAnthropic, mockMessages, mock_options);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        tool_choice: { type: mock_options.functionCall },
        tools: mock_options.functions.map((a) => ({
          name: a.name,
          description: a.description,
          input_schema: cleanJsonSchemaFor(
            a.parameters,
            mockStateAnthropic.provider
          ),
        })),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle anthropic with functionCall 'any' and set tool_choice", async () => {
    const mock_options = {
      functionCall: "any" as GenericFunctionCall,
      functions: [{ name: "something", description: "", parameters: {} }],
    };
    await useLlm_call(mockStateAnthropic, mockMessages, mock_options);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        tool_choice: { type: mock_options.functionCall },
        tools: mock_options.functions.map((a) => ({
          name: a.name,
          description: a.description,
          input_schema: cleanJsonSchemaFor(
            a.parameters,
            mockStateAnthropic.provider
          ),
        })),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle anthropic with specific function call object", async () => {
    const mock_options = {
      functionCall: { name: "something" },
      functions: [{ name: "something", description: "", parameters: {} }],
    };
    await useLlm_call(mockStateAnthropic, mockMessages, mock_options as any);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        tool_choice: mock_options.functionCall,
        tools: mock_options.functions.map((a) => ({
          name: a.name,
          description: a.description,
          input_schema: cleanJsonSchemaFor(
            a.parameters,
            mockStateAnthropic.provider
          ),
        })),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai with functionCall 'any' and normalize to 'required'", async () => {
    const mock_options = {
      functionCall: "any" as GenericFunctionCall,
      functions: [{ name: "something", description: "", parameters: {} }],
    };
    await useLlm_call(mockStateOpenAi, mockMessages, mock_options);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        tool_choice: "required",
        tools: mock_options.functions.map((a) => ({
          type: "function",
          function: {
            name: a.name,
            description: a.description,
            parameters: cleanJsonSchemaFor(
              a.parameters,
              mockStateOpenAi.provider
            ),
            strict: false,
          },
        })),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai with jsonSchema option", async () => {
    const mock_options = {
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["age", "name"],
        additionalProperties: false,
      },
    };

    await useLlm_call(mockStateOpenAi, mockMessages, mock_options as any);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai with no options passed", async () => {
    await useLlm_call(mockStateOpenAi, mockMessages, undefined as any);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: undefined,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai jsonSchema with functionCallStrictInput true", async () => {
    const mock_options = {
      functionCallStrictInput: true,
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["age", "name"],
        additionalProperties: false,
      },
    };
    await useLlm_call(mockStateOpenAi, mockMessages, mock_options as any);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: true,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai jsonSchema with functionCallStrictInput explicitly true", async () => {
    const mock_options = {
      functionCallStrictInput: true,
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["age", "name"],
        additionalProperties: false,
      },
    };
    await useLlm_call(mockStateOpenAi, mockMessages, mock_options);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: true,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai jsonSchema with functionCallStrictInput undefined (defaults to false)", async () => {
    const mock_options = {
      functionCallStrictInput: undefined,
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["age", "name"],
        additionalProperties: false,
      },
    };
    await useLlm_call(mockStateOpenAi, mockMessages, mock_options as any);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle openai jsonSchema with functionCallStrictInput false", async () => {
    const mock_options = {
      functionCallStrictInput: false,
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["age", "name"],
        additionalProperties: false,
      },
    };
    await useLlm_call(mockStateOpenAi, mockMessages, mock_options);
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle mock provider", async () => {
    const mockStateMock = {
      key: "openai.chat-mock.v1",
      provider: "openai.chat-mock",
    } as unknown as GenericLLm & {
      key: LlmProviderKey;
      provider: LlmProvider;
    };

    const mockConfigForMock = {
      ...mockConfig,
      provider: "openai.chat-mock",
    };

    getLlmConfigMock.mockReturnValue(mockConfigForMock);

    const mockOutputResult = { content: [], usage: {}, stopReason: "stop" };
    mockConfigForMock.transformResponse.mockReturnValueOnce(mockOutputResult);
    const mockBaseLlmOutputReturn = "mockParsedOutput";
    BaseLlmOutputMock.mockReturnValueOnce(mockBaseLlmOutputReturn);

    const result = await useLlm_call(mockStateMock, mockMessages, mockOptions);

    // Mock provider doesn't call apiRequest
    expect(apiRequestMock).not.toHaveBeenCalled();

    // But it should call transformResponse with the mock response
    expect(mockConfigForMock.transformResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "0123-45-6789",
        model: "model",
        created: expect.any(Number),
        usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
        choices: [
          {
            message: {
              role: "assistant",
              content: expect.stringContaining("Hello world from LLM!"),
            },
          },
        ],
      }),
      mockConfigForMock,
      {}
    );
    expect(BaseLlmOutput).toHaveBeenCalledWith(mockOutputResult);

    expect(result).toBe(mockBaseLlmOutputReturn);
  });

  describe("Google provider", () => {
    const mockStateGoogle = {
      key: "google.chat.v1",
      provider: "google.chat",
    } as unknown as GenericLLm & {
      key: LlmProviderKey;
      provider: LlmProvider;
    };

    beforeEach(() => {
      getLlmConfigMock.mockReturnValue(mockGoogleConfig);
    });

    it("should handle Google provider with function call", async () => {
      const mock_options = {
        functionCall: "auto" as GenericFunctionCall,
      };
      await useLlm_call(mockStateGoogle, mockMessages, mock_options);
      expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
          toolConfig: {
            functionCallingConfig: {
              mode: "auto",
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle Google provider with function call any", async () => {
      const mock_options = {
        functionCall: "any" as GenericFunctionCall,
      };
      await useLlm_call(mockStateGoogle, mockMessages, mock_options);
      expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
          toolConfig: {
            functionCallingConfig: {
              mode: "any",
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle Google provider with function call none", async () => {
      const mock_options = {
        functionCall: "none" as GenericFunctionCall,
      };
      await useLlm_call(mockStateGoogle, mockMessages, mock_options);
      expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
          toolConfig: {
            functionCallingConfig: {
              mode: "none",
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle Google provider with functions", async () => {
      const mock_options = {
        functions: [
          {
            name: "testFunction",
            description: "Test description",
            parameters: {
              type: "object",
              properties: {
                param1: { type: "string" },
              },
            },
          },
        ],
      };
      await useLlm_call(mockStateGoogle, mockMessages, mock_options);
      expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "testFunction",
                  description: "Test description",
                  parameters: cleanJsonSchemaFor(
                    mock_options.functions[0].parameters,
                    "google.chat"
                  ),
                },
              ],
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle Google provider with both functions and functionCall", async () => {
      const mock_options = {
        functionCall: "auto" as GenericFunctionCall,
        functions: [
          {
            name: "weatherFunction",
            description: "Get weather",
            parameters: {},
          },
        ],
      };
      await useLlm_call(mockStateGoogle, mockMessages, mock_options);
      expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages,
          toolConfig: {
            functionCallingConfig: {
              mode: "auto",
            },
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "weatherFunction",
                  description: "Get weather",
                  parameters: cleanJsonSchemaFor({}, "google.chat"),
                },
              ],
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });

  it("should handle deepseek provider with jsonSchema", async () => {
    const mockStateDeepseek = {
      ...mockState,
      provider: "deepseek.chat" as LlmProvider,
    };

    const mock_options = {
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    };

    await useLlm_call(mockStateDeepseek, mockMessages, mock_options as any);

    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle deepseek provider with functions", async () => {
    const mockStateDeepseek = {
      ...mockState,
      provider: "deepseek.chat" as LlmProvider,
    };

    const mock_options = {
      functionCall: "auto" as GenericFunctionCall,
      functions: [
        {
          name: "searchDatabase",
          description: "Search the database",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
      ],
      functionCallStrictInput: true,
    };

    await useLlm_call(mockStateDeepseek, mockMessages, mock_options);

    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        tool_choice: "auto",
        tools: [
          {
            type: "function",
            function: {
              name: "searchDatabase",
              description: "Search the database",
              parameters: cleanJsonSchemaFor(
                mock_options.functions[0].parameters,
                "deepseek.chat"
              ),
              strict: true,
            },
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle xai provider with jsonSchema", async () => {
    const mockStateXai = {
      ...mockState,
      provider: "xai.chat" as LlmProvider,
    };

    const mock_options = {
      jsonSchema: {
        type: "object",
        properties: {
          result: { type: "boolean" },
        },
      },
    };

    await useLlm_call(mockStateXai, mockMessages, mock_options as any);

    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "output",
            strict: false,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle xai provider with functions", async () => {
    const mockStateXai = {
      ...mockState,
      provider: "xai.chat" as LlmProvider,
    };

    const mock_options = {
      functionCall: { name: "getWeather" },
      functions: [
        {
          name: "getWeather",
          description: "Get weather info",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
          },
        },
      ],
    };

    await useLlm_call(mockStateXai, mockMessages, mock_options as any);

    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        tool_choice: { name: "getWeather" },
        tools: [
          {
            type: "function",
            function: {
              name: "getWeather",
              description: "Get weather info",
              parameters: cleanJsonSchemaFor(
                mock_options.functions[0].parameters,
                "xai.chat"
              ),
              strict: false,
            },
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should merge response_format when input already has response_format", async () => {
    // Setup mapBody to return input with existing response_format
    mapBodyMock.mockReturnValueOnce({
      prompt: mockMessages,
      response_format: {
        type: "json_object",
        existing_property: "should_preserve",
      },
    });

    const mock_options = {
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
      functionCallStrictInput: true,
    };

    await useLlm_call(mockStateOpenAi, mockMessages, mock_options as any);

    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
        response_format: {
          type: "json_schema",
          existing_property: "should_preserve",
          json_schema: {
            name: "output",
            strict: true,
            schema: mock_options.jsonSchema,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should not add response_format for provider that doesn't support jsonSchema", async () => {
    const mockStateOther = {
      ...mockState,
      key: "other.provider.v1" as LlmProviderKey,
      provider: "other.provider" as LlmProvider,
    };

    const mock_options = {
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    };

    await useLlm_call(mockStateOther, mockMessages, mock_options as any);

    // Should not have response_format since provider doesn't match the supported list
    expect(apiRequestMock).toHaveBeenCalledWith("http://api.test/endpoint", {
      method: mockConfig.method,
      body: JSON.stringify({
        prompt: mockMessages,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  it("should handle string messages input", async () => {
    const stringMessage = "Hello, this is a simple string message";

    const mockOutputResult = { content: [], usage: {}, stopReason: "stop" };
    mockConfig.transformResponse.mockReturnValueOnce(mockOutputResult);
    const mockBaseLlmOutputReturn = "stringMessageOutput";
    BaseLlmOutputMock.mockReturnValueOnce(mockBaseLlmOutputReturn);

    const result = await useLlm_call(mockState, stringMessage, mockOptions);

    expect(mapBody).toHaveBeenCalledWith(mockConfig.mapBody, {
      ...mockState,
      prompt: stringMessage,
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "http://api.test/endpoint",
      expect.objectContaining({
        method: mockConfig.method,
        body: JSON.stringify({
          prompt: mockMessages, // This is from the mock mapBody return value
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    expect(result).toBe(mockBaseLlmOutputReturn);
  });

  it("should use default output when config has no output function", async () => {
    const mockConfigNoOutput = {
      ...mockConfig,
      transformResponse: undefined,
      options: {
        model: {
          default: "test-model",
        },
      },
    };

    getLlmConfigMock.mockReturnValue(mockConfigNoOutput);

    const mockApiResponse = {
      text: "response text",
      output_tokens: 10,
      input_tokens: 5,
      stopReason: "complete",
    };
    apiRequestMock.mockResolvedValue({ data: mockApiResponse, headers: {} });

    const mockOutputDefaultResult = {
      name: "test-model",
      usage: {
        output_tokens: 10,
        input_tokens: 5,
        total_tokens: 15,
      },
      stopReason: "complete",
      content: [{ type: "text", text: "response text" }],
    };
    OutputDefaultMock.mockReturnValue(mockOutputDefaultResult);

    const mockBaseLlmOutputReturn = "defaultParsedOutput";
    BaseLlmOutputMock.mockReturnValueOnce(mockBaseLlmOutputReturn);

    const result = await useLlm_call(mockState, mockMessages);

    // Should call OutputDefault when no output function is provided
    expect(OutputDefaultMock).toHaveBeenCalledWith(
      mockApiResponse,
      mockConfigNoOutput,
      {}
    );

    // Should pass the result from OutputDefault to BaseLlmOutput
    expect(BaseLlmOutputMock).toHaveBeenCalledWith(mockOutputDefaultResult);

    expect(result).toBe(mockBaseLlmOutputReturn);
  });

  describe("apiRequest wrap maps request.http_error -> llm.provider_*", () => {
    function setupMocks() {
      getLlmConfigMock.mockReturnValue({
        provider: "openai.chat",
        key: "openai.chat.v1",
        endpoint: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        mapBody: {},
        options: {},
        headers: '{"Authorization":"Bearer {{token}}"}',
        transformResponse: jest.fn(),
      });
      replaceTemplateStringSimpleMock.mockReturnValue(
        "https://api.openai.com/v1/chat/completions"
      );
      mapBodyMock.mockReturnValue({});
      parseHeadersMock.mockResolvedValue({});
    }

    function makeRequestError(status: number, extra?: Record<string, unknown>) {
      return new LlmExeError(`Request failed: ${status}`, {
        code: "request.http_error",
        context: {
          operation: "apiRequest",
          url: "https://api.openai.com/v1/chat/completions",
          status,
          statusText: "Status",
          providerError: { message: "provider says no" },
          ...extra,
        },
      });
    }

    beforeEach(setupMocks);

    it.each([
      [429, "llm.provider_rate_limited"],
      [401, "llm.provider_auth_failed"],
      [403, "llm.provider_auth_failed"],
      [400, "llm.provider_invalid_request"],
      [422, "llm.provider_invalid_request"],
      [408, "llm.provider_unavailable"],
      [503, "llm.provider_unavailable"],
      [418, "llm.provider_http_error"],
    ])(
      "maps status %i to %s",
      async (status, expectedCode) => {
        apiRequestMock.mockRejectedValue(makeRequestError(status));
        try {
          await useLlm_call(mockStateOpenAi, "hi");
          throw new Error("Expected an error to be thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(LlmExeError);
          expect((e as InstanceType<typeof LlmExeError>).code).toBe(expectedCode);
          expect((e as InstanceType<typeof LlmExeError>).category).toBe("llm");
          const ctx = (e as InstanceType<typeof LlmExeError>).context as Record<
            string,
            unknown
          >;
          expect(ctx.provider).toBe("openai.chat");
          expect(ctx.status).toBe(status);
          expect(ctx.providerError).toEqual({ message: "provider says no" });
          expect((e as unknown as { cause?: unknown }).cause).toBeDefined();
        }
      }
    );

    it("falls back to llm.provider_http_error when no status is present", async () => {
      const err = new LlmExeError("network down", {
        code: "request.http_error",
        context: {
          operation: "apiRequest",
          url: "https://api.openai.com/v1/chat/completions",
        },
      });
      apiRequestMock.mockRejectedValue(err);
      try {
        await useLlm_call(mockStateOpenAi, "hi");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect((e as InstanceType<typeof LlmExeError>).code).toBe(
          "llm.provider_http_error"
        );
      }
    });

    it("handles request.http_error with no context (defaults to llm.provider_http_error)", async () => {
      const err = new LlmExeError("opaque failure", {
        code: "request.http_error",
      });
      apiRequestMock.mockRejectedValue(err);
      try {
        await useLlm_call(mockStateOpenAi, "hi");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(LlmExeError);
        expect((e as InstanceType<typeof LlmExeError>).code).toBe(
          "llm.provider_http_error"
        );
        const ctx = (e as InstanceType<typeof LlmExeError>).context as Record<
          string,
          unknown
        >;
        expect(ctx.operation).toBe("useLlm_call");
        expect(ctx.provider).toBe("openai.chat");
      }
    });

    it("does not wrap non-request.http_error errors", async () => {
      apiRequestMock.mockRejectedValue(
        new LlmExeError("bad url", {
          code: "request.invalid_url",
          context: { operation: "apiRequest", url: "x" },
        })
      );
      try {
        await useLlm_call(mockStateOpenAi, "hi");
        throw new Error("Expected an error to be thrown");
      } catch (e) {
        // Re-thrown unchanged — still request.invalid_url, not wrapped as llm.*
        expect((e as InstanceType<typeof LlmExeError>).code).toBe(
          "request.invalid_url"
        );
      }
    });
  });
});
