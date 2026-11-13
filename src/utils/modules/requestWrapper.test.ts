import {
  PROVIDED_OPTION_KEYS,
  stateFromOptions,
} from "@/llm/_utils.stateFromOptions";
import { deepFreeze } from "@/utils/modules/deepFreeze";
import { asyncCallWithTimeout } from "@/utils/modules/asyncCallWithTimeout";
import { backOff } from "exponential-backoff";
import { Config } from "@/types";
import { apiRequestWrapper } from "@/utils/modules/requestWrapper";
import { LlmExeError } from "@/errors";
import { getLlmConfig } from "@/llm/config";
import { createOpenAiCompatibleConfiguration } from "@/llm/config/openai/compatible";


jest.mock("exponential-backoff", () => ({
  backOff: jest.fn(),
}));

jest.mock("@/llm/_utils.stateFromOptions", () => ({
  ...jest.requireActual("@/llm/_utils.stateFromOptions"),
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
    mockHandler.mockReset();
    stateFromOptionsMock.mockReturnValue(mockState);
    deepFreezeMock.mockImplementation((obj) => obj);
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

  it("should report the effective timeout when explicitly undefined", () => {
    const apiRequest = apiRequestWrapper(
      mockConfig,
      { timeout: undefined },
      mockHandler,
    );

    expect(apiRequest.getMetadata().timeout).toBe(30000);
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

  it("should preserve maxDelay 0 in backoff and metadata", async () => {
    const options = {
      timeout: 1000,
      maxDelay: 0,
      numOfAttempts: 2,
      jitter: "none" as const,
    };
    const result = { ok: true };
    asyncCallWithTimeoutMock.mockResolvedValue(result);
    backOffMock.mockImplementation(async (fn) => fn());

    const apiRequest = apiRequestWrapper(mockConfig, options, mockHandler);
    await expect(apiRequest.call(mockMessages)).resolves.toBe(result);

    expect(apiRequest.getMetadata()).toEqual(
      expect.objectContaining({
        timeout: 1000,
        maxDelay: 0,
        numOfAttempts: 2,
      })
    );
    expect(backOffMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ maxDelay: 0, numOfAttempts: 2 })
    );
  });

  it.each([
    ["timeout", 0],
    ["numOfAttempts", 0],
    ["maxDelay", -1],
  ] as const)("should reject invalid %s", (option, value) => {
    expect(() =>
      apiRequestWrapper(mockConfig, { [option]: value }, mockHandler)
    ).toThrow(
      expect.objectContaining({
        code: "configuration.incompatible_options",
      })
    );
  });

  it.each([
    ["timeout", Number.NaN],
    ["numOfAttempts", Number.POSITIVE_INFINITY],
    ["maxDelay", Number.NEGATIVE_INFINITY],
  ] as const)("should reject non-finite %s", (option, value) => {
    expect(() =>
      apiRequestWrapper(mockConfig, { [option]: value }, mockHandler)
    ).toThrow(
      expect.objectContaining({
        code: "configuration.incompatible_options",
      })
    );
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
        const shouldRetry = await options.retry(err, 1);
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
      startingDelay: 500,
      timeMultiple: 2,
      maxDelay: mockOptions.maxDelay,
      numOfAttempts: mockOptions.numOfAttempts,
      jitter: mockOptions.jitter,
      retry: expect.any(Function),
    });

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining(mockState),
      expect.objectContaining(mockMessages),
      undefined,
      expect.any(AbortSignal),
    );
    expect(mockHandler.mock.calls[0][0]).not.toBe(mockState);
    expect(mockHandler.mock.calls[0][1]).not.toBe(mockMessages);
  });

  it("should not retry on certain errors", async () => {
    const specificError = new Error("Do Not Retry");
    asyncCallWithTimeoutMock.mockRejectedValue(specificError);
    backOffMock.mockClear().mockImplementation(async (fn, options) => {
      try {
        return await fn();
      } catch (err) {
        const shouldRetry = await options.retry(err, 1);
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
      startingDelay: 500,
      timeMultiple: 2,
      maxDelay: mockOptions.maxDelay,
      numOfAttempts: mockOptions.numOfAttempts,
      jitter: mockOptions.jitter,
      retry: expect.any(Function),
    });

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining(mockState),
      expect.objectContaining(mockMessages),
      undefined,
      expect.any(AbortSignal),
    );
    expect(mockHandler.mock.calls[0][0]).not.toBe(mockState);
    expect(mockHandler.mock.calls[0][1]).not.toBe(mockMessages);
  });

  it("preserves option provenance when cloning state before freezing", async () => {
    const providedOptionKeys = new Set(["maxTokens"]);
    const callerState = {
      ...mockState,
      [PROVIDED_OPTION_KEYS]: providedOptionKeys,
    };
    stateFromOptionsMock.mockReturnValueOnce(callerState);
    asyncCallWithTimeoutMock.mockResolvedValue("result");
    backOffMock.mockImplementation(async (fn) => fn());

    const apiRequest = setupAPIRequestWrapper();
    await apiRequest.call(mockMessages);

    const receivedState = mockHandler.mock.calls[0][0];
    expect(receivedState).not.toBe(callerState);
    expect(Reflect.get(receivedState, PROVIDED_OPTION_KEYS)).toBe(
      providedOptionKeys,
    );
  });

  it("does not retry deterministic LlmExeError categories (configuration/prompt/auth) (#723)", async () => {
    const configError = new LlmExeError("maxTokens required", {
      code: "configuration.missing_option",
      context: { operation: "test" },
    });
    asyncCallWithTimeoutMock.mockRejectedValue(configError);
    backOffMock.mockClear().mockImplementation(async (fn, options) => {
      try {
        return await fn();
      } catch (err) {
        const shouldRetry = await options.retry(err, 1);
        if (shouldRetry) {
          return await fn();
        } else {
          throw err;
        }
      }
    });

    // No doNotRetryErrorMessages entry — the short-circuit is category-based.
    const apiRequest = setupAPIRequestWrapper();
    await expect(apiRequest.call(mockMessages)).rejects.toThrow(
      "maxTokens required"
    );

    const metrics = apiRequest.getMetadata().metrics as any;
    expect(metrics.total_call_retry).toBe(0);
    expect(metrics.total_call_error).toBe(1);
    // handler ran exactly once — the deterministic error was not retried
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it("still retries a non-LlmExeError (transient) error", async () => {
    asyncCallWithTimeoutMock.mockRejectedValue(new Error("Transient"));
    let retryDecision: boolean | undefined;
    backOffMock.mockClear().mockImplementation(async (fn, options) => {
      try {
        return await fn();
      } catch (err) {
        retryDecision = await options.retry(err, 1);
        throw err;
      }
    });
    const apiRequest = setupAPIRequestWrapper();
    await expect(apiRequest.call(mockMessages)).rejects.toThrow("Transient");
    expect(retryDecision).toBe(true);
  });

  // #726 — deterministic codes inside otherwise-mixed categories (llm.*, embedding.*)
  // must not be retried, even though the category short-circuit alone can't reach them.
  it.each([
    "llm.provider_auth_failed",
    "llm.provider_invalid_request",
    "embedding.provider_auth_failed",
    "embedding.provider_invalid_request",
    "embedding.unsupported_input",
    "embedding.unsupported_dimensions",
  ] as const)(
    "does not retry deterministic code %s (#726)",
    async (code) => {
      const error = new LlmExeError(`deterministic ${code}`, {
        code,
        context: { operation: "test" },
      });
      asyncCallWithTimeoutMock.mockRejectedValue(error);
      backOffMock.mockClear().mockImplementation(async (fn, options) => {
        try {
          return await fn();
        } catch (err) {
          const shouldRetry = await options.retry(err, 1);
          if (shouldRetry) {
            return await fn();
          } else {
            throw err;
          }
        }
      });

      const apiRequest = setupAPIRequestWrapper();
      await expect(apiRequest.call(mockMessages)).rejects.toThrow(
        `deterministic ${code}`
      );

      const metrics = apiRequest.getMetadata().metrics as any;
      expect(metrics.total_call_retry).toBe(0);
      expect(metrics.total_call_error).toBe(1);
      // handler ran exactly once — the deterministic error was not retried
      expect(mockHandler).toHaveBeenCalledTimes(1);
    }
  );

  it("still retries a transient LlmExeError in a mixed category (embedding.provider_rate_limited) (#726)", async () => {
    const error = new LlmExeError("rate limited", {
      code: "embedding.provider_rate_limited",
      context: { operation: "test" },
    });
    asyncCallWithTimeoutMock.mockRejectedValue(error);
    let retryDecision: boolean | undefined;
    backOffMock.mockClear().mockImplementation(async (fn, options) => {
      try {
        return await fn();
      } catch (err) {
        retryDecision = await options.retry(err, 1);
        throw err;
      }
    });

    const apiRequest = setupAPIRequestWrapper();
    await expect(apiRequest.call(mockMessages)).rejects.toThrow("rate limited");
    // transient code shares the embedding category — must NOT be short-circuited
    expect(retryDecision).toBe(true);
    expect((apiRequest.getMetadata().metrics as any).total_call_retry).toBe(1);
  });

  describe("getMetadata credential redaction", () => {
    const SECRET = "SECRET-123";

    it.each([
      ["google.chat.v1", "geminiApiKey"],
      ["xai.chat.v1", "xAiApiKey"],
      ["deepseek.chat.v1", "deepseekApiKey"],
      ["openai.chat.v1", "openAiApiKey"],
      ["anthropic.chat.v1", "anthropicApiKey"],
      ["amazon:anthropic.chat.v1", "awsSecretKey"],
      ["amazon:anthropic.chat.v1", "awsAccessKey"],
    ] as const)("redacts %s %s", (provider, keyOption) => {
      const apiRequest = apiRequestWrapper(
        getLlmConfig(provider),
        { model: "m", maxTokens: 10, [keyOption]: SECRET },
        mockHandler
      );
      const metadata = apiRequest.getMetadata();
      expect(metadata).not.toHaveProperty(keyOption);
      expect(JSON.stringify(metadata)).not.toContain(SECRET);
      expect(metadata).toEqual(
        expect.objectContaining({ model: "m", maxTokens: 10 })
      );
    });

    it("redacts the apiKeyMapping option of a custom compatible config", () => {
      const config = createOpenAiCompatibleConfiguration({
        key: "local.chat.v1",
        provider: "local.chat",
        endpoint: "http://localhost:1234/v1/chat/completions",
        apiKeyMapping: ["localKey", "LOCAL_KEY"],
      });
      const apiRequest = apiRequestWrapper(
        config,
        { model: "m", localKey: SECRET },
        mockHandler
      );
      const metadata = apiRequest.getMetadata();
      expect(metadata).not.toHaveProperty("localKey");
      expect(JSON.stringify(metadata)).not.toContain(SECRET);
      expect(metadata).toHaveProperty("model", "m");
    });
  });

});
