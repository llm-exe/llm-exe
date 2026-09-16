import { IChatMessages, Config } from "@/types";
import { getLlmConfig } from "@/llm/config";
import { useLlm, useLlmConfiguration } from "@/llm/llm";
import { useLlm_call } from "@/llm/llm.call";

jest.mock("@/llm/config", () => ({
  getLlmConfig: jest.fn(),
}));

jest.mock("@/llm/llm.call", () => ({
  useLlm_call: jest.fn(),
}));

describe("useLlm", () => {
  const getLlmConfigMock = getLlmConfig as jest.Mock;

  const mockProvider = "openai.chat-mock.v1";

  const mockOptions = {
    option1: "value1",
    model: "something",
    traceId: "custom-traceId",
  };
  const mockConfig = {
    options: {
      option1: {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getLlmConfigMock.mockReturnValue(mockConfig);
  });

  it("should create an instance with call, getTraceId, and getMetadata methods", () => {
    const { call, getTraceId, getMetadata } = useLlm(mockProvider, mockOptions);

    expect(typeof call).toBe("function");
    expect(typeof getTraceId).toBe("function");
    expect(typeof getMetadata).toBe("function");
  });

  it("getTraceId should return fixed traceId", () => {
    const { getTraceId } = useLlm(mockProvider, mockOptions);

    expect(getTraceId()).toBe(mockOptions.traceId);
  });

  it("getMetadata should return state excluding API keys", () => {
    const { getMetadata } = useLlm(mockProvider, mockOptions);
    const metadata = getMetadata();
    expect(metadata).not.toHaveProperty("awsSecretKey");
    expect(metadata).not.toHaveProperty("awsAccessKey");
    expect(metadata).not.toHaveProperty("openAiApiKey");
    expect(metadata).not.toHaveProperty("anthropicApiKey");
  });

  it("call method should invoke useLlm_call with correct arguments", async () => {
    const mockMessages = [
      {
        role: "user",
        content: "Hello",
      },
    ] as IChatMessages;
    const { call } = useLlm(mockProvider, mockOptions);

    await call(mockMessages);

    expect(useLlm_call).toHaveBeenCalledWith(
      expect.anything(),
      mockMessages,
      undefined,
      mockConfig
    );
  });

  it("call method should invoke useLlm_call with correct arguments when undefined", async () => {
    const mockMessages = [
      {
        role: "user",
        content: "Hello",
      },
    ] as IChatMessages;
    const { call } = useLlm(mockProvider);

    await call(mockMessages);

    expect(useLlm_call).toHaveBeenCalledWith(
      expect.anything(),
      mockMessages,
      undefined,
      mockConfig
    );
  });
});

describe("useLlmConfiguration", () => {
  const mockConfig: Config<any> = {
    key: "openai.custom" as any,
    provider: "openai.chat",
    endpoint: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: `{"Authorization":"Bearer {{apiKey}}", "Content-Type": "application/json"}`,
    mapBody: {
      prompt: { key: "messages" },
      model: { key: "model" },
    },
    options: {
      model: {
        default: "gpt-4",
      },
    },
    transformResponse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a function that creates an LLM instance", () => {
    const llmFactory = useLlmConfiguration(mockConfig);
    expect(typeof llmFactory).toBe("function");
  });

  it("should create an LLM instance with call, getTraceId, and getMetadata methods", () => {
    const llmFactory = useLlmConfiguration(mockConfig);
    const llmInstance = llmFactory();

    expect(typeof llmInstance.call).toBe("function");
    expect(typeof llmInstance.getTraceId).toBe("function");
    expect(typeof llmInstance.getMetadata).toBe("function");
  });

  it("should accept options when creating LLM instance", () => {
    const llmFactory = useLlmConfiguration(mockConfig);
    const options = {
      model: "gpt-3.5-turbo",
      temperature: 0.5,
    };
    const llmInstance = llmFactory(options);

    expect(llmInstance).toBeDefined();
    expect(typeof llmInstance.call).toBe("function");
  });

  it("should create different instances for different option sets", () => {
    const llmFactory = useLlmConfiguration(mockConfig);

    const instance1 = llmFactory({ traceId: "trace-1" });
    const instance2 = llmFactory({ traceId: "trace-2" });

    expect(instance1.getTraceId()).toBe("trace-1");
    expect(instance2.getTraceId()).toBe("trace-2");
  });

  it("should work with empty options", () => {
    const llmFactory = useLlmConfiguration(mockConfig);
    const llmInstance = llmFactory({});

    expect(typeof llmInstance.call).toBe("function");
    expect(typeof llmInstance.getTraceId).toBe("function");
    expect(typeof llmInstance.getMetadata).toBe("function");
  });

  it("should work without any options (undefined)", () => {
    const llmFactory = useLlmConfiguration(mockConfig);
    const llmInstance = llmFactory();

    expect(typeof llmInstance.call).toBe("function");
    expect(typeof llmInstance.getTraceId).toBe("function");
    expect(typeof llmInstance.getMetadata).toBe("function");
  });

  it("should allow calling the created LLM instance", async () => {
    const llmFactory = useLlmConfiguration(mockConfig);
    const llmInstance = llmFactory({ model: "custom-model" });

    const mockMessages = [
      {
        role: "user",
        content: "Hello from configuration",
      },
    ] as IChatMessages;

    await llmInstance.call(mockMessages);

    expect(useLlm_call).toHaveBeenCalledWith(
      expect.anything(),
      mockMessages,
      undefined,
      mockConfig
    );
  });
});
