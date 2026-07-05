import { stateFromOptions } from "@/llm/_utils.stateFromOptions";
import { deepFreeze } from "@/utils/modules/deepFreeze";
import { asyncCallWithTimeout } from "@/utils/modules/asyncCallWithTimeout";
import { backOff } from "exponential-backoff";
import { Config } from "@/types";
import { apiRequestWrapper } from "@/utils/modules/requestWrapper";


jest.mock("exponential-backoff", () => ({
  backOff: jest.fn(),
}));

jest.mock("@/llm/_utils.stateFromOptions", () => ({
  stateFromOptions: jest.fn(),
}));

jest.mock("@/utils/modules/deepFreeze", () => ({
  deepFreeze: jest.fn(),
}));

jest.mock("@/utils/modules/asyncCallWithTimeout", () => ({
  asyncCallWithTimeout: jest.fn(),
}));


describe("apiRequestWrapper", () => {
  const backOffMock = backOff as jest.Mock;
  const stateFromOptionsMock = stateFromOptions as jest.Mock;
  const deepFreezeMock = deepFreeze as jest.Mock;
  const asyncCallWithTimeoutMock = asyncCallWithTimeout as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    stateFromOptionsMock.mockReset()
    deepFreezeMock.mockReset()
    asyncCallWithTimeoutMock.mockReset()
    backOffMock.mockReset()
  });

  const mockConfig: Config<any> = {} as any;
  const mockOptions = {
    timeout: 10000,
    maxDelay: 2000,
    numOfAttempts: 3,
    jitter: "full" as "none" | "full",
    traceId: "test-trace-id",
  };
  const mockHandler = jest.fn<Promise<any>, any>();
  const mockState = {};
  const mockMessages = { messageContent: "test" }

  stateFromOptionsMock.mockReturnValue(mockState);
  deepFreezeMock.mockImplementation((obj) => obj);

  function setupAPIRequestWrapper(doNotRetryErrorMessages: string[] = []) {
    return apiRequestWrapper(mockConfig, mockOptions, mockHandler, doNotRetryErrorMessages);
  }

  it("should initialize with correct state and options", () => {
    setupAPIRequestWrapper();
    expect(stateFromOptionsMock).toHaveBeenCalledWith(mockOptions, mockConfig);
  });

  it("should return the correct metadata", () => {
    const apiRequest = setupAPIRequestWrapper();
    const metadata = apiRequest.getMetadata();
    expect(metadata).toEqual({
      traceId: "test-trace-id",
      timeout: mockOptions.timeout,
      jitter: mockOptions.jitter,
      maxDelay: mockOptions.maxDelay,
      numOfAttempts: mockOptions.numOfAttempts,
      metrics: {
        total_calls: 0,
        total_call_success: 0,
        total_call_retry: 0,
        total_call_error: 0,
        history: [],
      },
    });
  });

  it("should redact every provider credential option from metadata", () => {
    const secretOptions = {
      openAiApiKey: "sk-openai",
      anthropicApiKey: "sk-anthropic",
      geminiApiKey: "sk-gemini",
      xAiApiKey: "sk-xai",
      deepseekApiKey: "sk-deepseek",
      ollamaApiKey: "sk-ollama",
      apiKey: "sk-generic",
      awsSecretKey: "aws-secret",
      awsAccessKey: "aws-access",
      awsSessionToken: "aws-session",
      password: "hunter2",
      credentials: "creds",
    };
    const apiRequest = apiRequestWrapper(
      mockConfig,
      { ...mockOptions, ...secretOptions },
      mockHandler,
      []
    );
    const metadata = apiRequest.getMetadata();
    for (const [key, value] of Object.entries(secretOptions)) {
      expect(metadata).not.toHaveProperty(key);
      expect(JSON.stringify(metadata)).not.toContain(value);
    }
  });

  it("should keep non-secret options in metadata", () => {
    const apiRequest = apiRequestWrapper(
      mockConfig,
      { ...mockOptions, model: "gpt-4o-mini", maxTokens: 512 },
      mockHandler,
      []
    );
    const metadata = apiRequest.getMetadata();
    expect(metadata.model).toBe("gpt-4o-mini");
    expect(metadata.maxTokens).toBe(512);
    expect(metadata.traceId).toBe("test-trace-id");
  });

  it("should return the correct traceId", () => {
    const apiRequest = setupAPIRequestWrapper();
    expect(apiRequest.getTraceId()).toBe("test-trace-id");
  });

  it("should update traceId correctly", () => {
    const apiRequest = apiRequestWrapper(mockConfig, mockOptions, mockHandler, []);
    apiRequest.withTraceId("new-trace-id");
    expect(apiRequest.getTraceId()).toBe("new-trace-id");
  });

//   it("should call handler and backOff with correct parameters and handle success", async () => {
//     backOffMock.mockImplementation(async (fn) => {
//       return fn();
//     });
//     asyncCallWithTimeoutMock.mockResolvedValue(mockResult);

//     const apiRequest = setupAPIRequestWrapper();
//     const result = await apiRequest.call(mockMessages);
    
//     const metrics = (apiRequest.getMetadata().metrics as any);
//     expect(metrics.total_calls).toBe(1);
//     expect(metrics.total_call_success).toBe(1);
//     expect(metrics.total_call_retry).toBe(0);
//     expect(metrics.total_call_error).toBe(0);
//     expect(result).toEqual(mockResult);

//     expect(mockHandler).toHaveBeenCalledWith(
//       deepFreeze(mockState),
//       deepFreeze(mockMessages),
//       deepFreeze({})
//     );

//     expect(asyncCallWithTimeoutMock).toHaveBeenCalledWith(expect.any(Promise), mockOptions.timeout);
//     expect(backOffMock).toHaveBeenCalledWith(expect.any(Function), {
//       startingDelay: 0,
//       maxDelay: mockOptions.maxDelay,
//       numOfAttempts: mockOptions.numOfAttempts,
//       jitter: mockOptions.jitter,
//       retry: expect.any(Function),
//     });
//   });

  it("should retry on failure and handle max retries", async () => {
    const error = new Error("Transient Error");
    asyncCallWithTimeoutMock.mockRejectedValue(error);
    backOffMock.mockClear().mockImplementation(async (fn, options) => {
      try {
        return await fn();
      } catch (err) {
        const shouldRetry = options.retry(err, 1);
        if (shouldRetry) {
          return await fn();
        } else {
          throw err;  
        }
      }
    });

    const apiRequest = setupAPIRequestWrapper();
    await expect(apiRequest.call(mockMessages)).rejects.toThrow("Transient Error");

    const metrics = (apiRequest.getMetadata().metrics as any);
    expect(metrics.total_calls).toBe(1);
    expect(metrics.total_call_success).toBe(0);
    expect(metrics.total_call_retry).toBe(1);
    expect(metrics.total_call_error).toBe(1);

    expect(backOffMock).toHaveBeenCalledWith(expect.any(Function), {
      startingDelay: 0,
      maxDelay: mockOptions.maxDelay,
      numOfAttempts: mockOptions.numOfAttempts,
      jitter: mockOptions.jitter,
      retry: expect.any(Function),
    });

    expect(mockHandler).toHaveBeenCalledWith(deepFreeze(mockState), deepFreeze(mockMessages), deepFreeze({}));
  });

  it("should not retry on certain errors", async () => {
    const specificError = new Error("Do Not Retry");
    asyncCallWithTimeoutMock.mockRejectedValue(specificError);
    backOffMock.mockClear().mockImplementation(async (fn, options) => {
      try {
        return await fn();
      } catch (err) {
        const shouldRetry = options.retry(err, 1);
        if (shouldRetry) {
          return await fn();
        } else {
          throw err;
        }
      }
    });

    const apiRequest = setupAPIRequestWrapper(["Do Not Retry"]);
    await expect(apiRequest.call(mockMessages)).rejects.toThrow("Do Not Retry");

    const metrics = (apiRequest.getMetadata().metrics as any);
    expect(metrics.total_calls).toBe(1);
    expect(metrics.total_call_success).toBe(0);
    expect(metrics.total_call_retry).toBe(0);
    expect(metrics.total_call_error).toBe(1);

    expect(backOffMock).toHaveBeenCalledWith(expect.any(Function), {
      startingDelay: 0,
      maxDelay: mockOptions.maxDelay,
      numOfAttempts: mockOptions.numOfAttempts,
      jitter: mockOptions.jitter,
      retry: expect.any(Function),
    });

    expect(mockHandler).toHaveBeenCalledWith(deepFreeze(mockState), deepFreeze(mockMessages), deepFreeze({}));
  });

});