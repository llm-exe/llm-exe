import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { getAwsAuthorizationHeaders } from "@/utils/modules/getAwsAuthorizationHeaders";
import { Config } from "@/types";
import { parseHeaders } from "@/llm/_utils.parseHeaders";
import { LlmExeError } from "@/errors";

jest.mock("@/utils/modules/replaceTemplateStringSimple");
jest.mock("@/utils/modules/getEnvironmentVariable");
jest.mock("@/utils");
jest.mock("@/utils/modules/getAwsAuthorizationHeaders");

describe("parseHeaders", () => {
  let config: Config;
  let replacements: Record<string, any>;
  let payload: { url: string; headers: Record<string, any>; body: string };

  beforeEach(() => {
    config = {
      headers: '{"Authorization": "Bearer {{token}}"}',
      endpoint: "",
      options: {},
      mapBody: {},
      method: "POST",
      provider: "openai.chat-mock",
      key: "openai.chat-mock.v1",
      transformResponse: () => ({
        id: "",
        name: "",
        created: 0,
        content: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        stopReason: "stop",
      }),
    };
    replacements = {
      token: "test-token",
      awsSecretKey: "test-secret",
      awsAccessKey: "test-access",
      awsRegion: "test-region",
    };
    payload = {
      url: "https://example.com",
      headers: { "User-Agent": "test-agent" },
      body: '{"data":"test"}',
    };

    (replaceTemplateStringSimple as jest.Mock).mockReturnValue(
      '{"Authorization": "Bearer test-token"}'
    );
    (getEnvironmentVariable as jest.Mock).mockReturnValue("default-region");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should merge headers and return them when provider is not amazon", async () => {
    config.provider = "openai.chat";

    const headers = await parseHeaders(config, replacements, payload);

    expect(headers).toEqual({
      "User-Agent": "test-agent",
      Authorization: "Bearer test-token",
    });
  });

  it("Should call getAwsAuthorizationHeaders when provider starts with amazon", async () => {
    config.provider = "amazon:anthropic.chat";
    const expectedHeaders = {
      "User-Agent": "test-agent",
      Authorization: "AWS4-HMAC-SHA256",
    };

    (getAwsAuthorizationHeaders as jest.Mock).mockResolvedValue(
      expectedHeaders
    );

    const headers = await parseHeaders(config, replacements, payload);

    expect(getAwsAuthorizationHeaders).toHaveBeenCalledWith(
      {
        method: "POST",
        headers: {
          "User-Agent": "test-agent",
          Authorization: "Bearer test-token",
        },
        body: '{"data":"test"}',
      },
      {
        url: "https://example.com",
        regionName: "test-region",
        awsSecretKey: "test-secret",
        awsAccessKey: "test-access",
      }
    );

    expect(headers).toEqual(expectedHeaders);
  });

  it("Should use default AWS region when replacements do not contain a region", async () => {
    config.provider = "amazon:anthropic.chat";
    delete replacements.awsRegion;

    const expectedHeaders = {
      "User-Agent": "test-agent",
      Authorization: "AWS4-HMAC-SHA256",
    };

    (getAwsAuthorizationHeaders as jest.Mock).mockResolvedValue(
      expectedHeaders
    );

    const headers = await parseHeaders(config, replacements, payload);

    expect(getEnvironmentVariable).toHaveBeenCalledWith("AWS_REGION");

    expect(getAwsAuthorizationHeaders).toHaveBeenCalledWith(
      {
        method: "POST",
        headers: {
          "User-Agent": "test-agent",
          Authorization: "Bearer test-token",
        },
        body: '{"data":"test"}',
      },
      {
        url: "https://example.com",
        regionName: "default-region",
        awsSecretKey: "test-secret",
        awsAccessKey: "test-access",
      }
    );

    expect(headers).toEqual(expectedHeaders);
  });

  it("Should return parsed headers when replaceTemplateStringSimple returns an empty string", async () => {
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue("");

    const headers = await parseHeaders(config, replacements, payload);

    expect(headers).toEqual(payload.headers);
  });

  it("Should throw an error when headers template produces invalid JSON", async () => {
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue("not valid json");

    await expect(parseHeaders(config, replacements, payload)).rejects.toThrow(
      /Failed to parse headers configuration/
    );
  });

  it("throws LlmExeError with configuration.invalid_headers and preserves cause", async () => {
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue("not valid json");

    try {
      await parseHeaders(config, replacements, payload);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("configuration.invalid_headers");
      expect((e as LlmExeError).category).toBe("configuration");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("parseHeaders");
      expect(ctx.provider).toBe("openai.chat-mock");
      expect(ctx.key).toBe("openai.chat-mock.v1");
      expect(ctx.headerTemplate).toBe(config.headers);
      expect(ctx.replacedHeadersExcerpt).toBe("not valid json");
      expect((e as unknown as { cause?: unknown }).cause).toBeDefined();
      expect((e as unknown as { cause?: Error }).cause).toBeInstanceOf(Error);
    }
  });

  it("redacts secrets from the post-replacement string before exposing it", async () => {
    // Simulate a real-world failure: the template resolves to a string
    // containing a real Authorization header AND fails to parse as JSON.
    const replacedWithSecret =
      '{"Authorization": "Bearer sk-syntheticHeadersLeakTokenAAAAAA", broken}';
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue(
      replacedWithSecret
    );

    try {
      await parseHeaders(config, replacements, payload);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      const err = e as LlmExeError;
      const ctx = err.context as Record<string, unknown>;
      // Neither the message nor the context excerpt may contain the secret.
      expect(err.message).not.toContain("sk-syntheticHeadersLeakTokenAAAAAA");
      expect(String(ctx.replacedHeadersExcerpt)).not.toContain(
        "sk-syntheticHeadersLeakTokenAAAAAA"
      );
      // And both should show some form of redaction marker so a reader
      // knows what was suppressed.
      expect(String(ctx.replacedHeadersExcerpt)).toContain("[redacted]");
    }
  });

  it("Should throw an error with detailed context when JSON parsing fails", async () => {
    config.headers = '{"broken": {{token}}}';
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue(
      '{"broken": test-token}'
    );

    await expect(parseHeaders(config, replacements, payload)).rejects.toThrow(
      /After replacement/
    );
  });

  it("Should throw an error when parsed headers is an array", async () => {
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue('[1, 2, 3]');

    await expect(parseHeaders(config, replacements, payload)).rejects.toThrow(
      /Headers must be a JSON object/
    );
  });

  it("Should throw an error when parsed headers is null", async () => {
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue("null");

    await expect(parseHeaders(config, replacements, payload)).rejects.toThrow(
      /Headers must be a JSON object/
    );
  });

  it("Should include 'Unknown error' in message when catch receives a non-Error value", async () => {
    (replaceTemplateStringSimple as jest.Mock).mockReturnValue('{"valid": true}');
    const originalParse = JSON.parse;
    JSON.parse = () => { throw "string error"; };

    try {
      await expect(parseHeaders(config, replacements, payload)).rejects.toThrow(
        /Failed to parse headers configuration: Unknown error/
      );
    } finally {
      JSON.parse = originalParse;
    }
  });

  it("Should call getAwsAuthorizationHeaders when provider starts with amazon.", async () => {
    config.provider = "amazon.nova.chat" as any;
    const expectedHeaders = { Authorization: "AWS4-HMAC-SHA256" };

    (getAwsAuthorizationHeaders as jest.Mock).mockResolvedValue(
      expectedHeaders
    );

    const headers = await parseHeaders(config, replacements, payload);

    expect(getAwsAuthorizationHeaders).toHaveBeenCalled();
    expect(headers).toEqual(expectedHeaders);
  });
});
