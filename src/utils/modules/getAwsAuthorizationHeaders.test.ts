import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@smithy/signature-v4";
// @ts-expect-error - this needs to be imported or the test fails
import { Sha256 } from "@aws-crypto/sha256-js";
import { getAwsAuthorizationHeaders } from "@/utils/modules/getAwsAuthorizationHeaders";
import { LlmExeError } from "@/errors";

jest.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: jest.fn(),
}));

jest.mock("@smithy/signature-v4", () => ({
  SignatureV4: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
  })),
}));

jest.mock("@aws-crypto/sha256-js");

describe("getAwsAuthorizationHeaders", () => {
  const fromNodeProviderChainMock = fromNodeProviderChain as jest.Mock;
  const SignatureV4Mock = SignatureV4 as jest.Mock;

  const staticKeyProps = {
    url: "https://example.com",
    regionName: "us-east-1",
    awsAccessKey: "testAccessKey",
    awsSecretKey: "testSecretKey",
    awsSessionToken: "testSessionToken",
  };

  function mockSigner() {
    const mockSign = jest.fn().mockResolvedValue({
      headers: { Authorization: "signed-header-value" },
    });
    SignatureV4Mock.mockImplementation(() => ({
      sign: mockSign,
    }));
    return mockSign;
  }

  beforeEach(() => {
    fromNodeProviderChainMock.mockClear();
    SignatureV4Mock.mockClear();
  });

  it("passes explicit keys to the signer as static credentials without touching process.env", async () => {
    const req: RequestInit = {
      method: "GET",
      headers: { "custom-header": "value" },
    };
    mockSigner();
    const envBefore = {
      accessKey: process.env["AWS_ACCESS_KEY_ID"],
      secretKey: process.env["AWS_SECRET_ACCESS_KEY"],
      sessionToken: process.env["AWS_SESSION_TOKEN"],
    };

    const headers = await getAwsAuthorizationHeaders(req, staticKeyProps);

    expect(headers).toEqual({ Authorization: "signed-header-value" });
    expect(fromNodeProviderChainMock).not.toHaveBeenCalled();
    expect(SignatureV4Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          accessKeyId: "testAccessKey",
          secretAccessKey: "testSecretKey",
          sessionToken: "testSessionToken",
        },
      })
    );
    expect(process.env["AWS_ACCESS_KEY_ID"]).toBe(envBefore.accessKey);
    expect(process.env["AWS_SECRET_ACCESS_KEY"]).toBe(envBefore.secretKey);
    expect(process.env["AWS_SESSION_TOKEN"]).toBe(envBefore.sessionToken);
  });

  it("omits sessionToken from static credentials when not provided", async () => {
    mockSigner();

    await getAwsAuthorizationHeaders(
      { method: "GET" },
      { ...staticKeyProps, awsSessionToken: undefined }
    );

    expect(SignatureV4Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          accessKeyId: "testAccessKey",
          secretAccessKey: "testSecretKey",
        },
      })
    );
  });

  it("concurrent calls with different keys each sign with their own credentials", async () => {
    mockSigner();
    const propsA = { ...staticKeyProps, awsAccessKey: "keyA", awsSecretKey: "secretA" };
    const propsB = { ...staticKeyProps, awsAccessKey: "keyB", awsSecretKey: "secretB" };

    await Promise.all([
      getAwsAuthorizationHeaders({ method: "GET" }, propsA),
      getAwsAuthorizationHeaders({ method: "GET" }, propsB),
    ]);

    const credentialsSeen = SignatureV4Mock.mock.calls.map(
      ([options]) => options.credentials
    );
    expect(credentialsSeen).toContainEqual(
      expect.objectContaining({ accessKeyId: "keyA", secretAccessKey: "secretA" })
    );
    expect(credentialsSeen).toContainEqual(
      expect.objectContaining({ accessKeyId: "keyB", secretAccessKey: "secretB" })
    );
  });

  it("falls back to the node provider chain when no keys are provided", async () => {
    const chainCredentials = {
      accessKeyId: "chainAccessKey",
      secretAccessKey: "chainSecretKey",
    };
    fromNodeProviderChainMock.mockReturnValue(() =>
      Promise.resolve(chainCredentials)
    );
    mockSigner();

    const headers = await getAwsAuthorizationHeaders(
      { method: "GET" },
      {
        url: "https://example.com",
        regionName: "us-east-1",
        awsAccessKey: null,
        awsSecretKey: undefined,
        awsSessionToken: "",
      }
    );

    expect(headers).toEqual({ Authorization: "signed-header-value" });
    expect(fromNodeProviderChainMock).toHaveBeenCalledTimes(1);
    expect(SignatureV4Mock).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: chainCredentials })
    );
  });

  it("falls back to the provider chain when only one half of the key pair is provided", async () => {
    const chainCredentials = {
      accessKeyId: "chainAccessKey",
      secretAccessKey: "chainSecretKey",
    };
    fromNodeProviderChainMock.mockReturnValue(() =>
      Promise.resolve(chainCredentials)
    );
    mockSigner();

    await getAwsAuthorizationHeaders(
      { method: "GET" },
      {
        url: "https://example.com",
        regionName: "us-east-1",
        awsAccessKey: "validAccessKey",
        awsSecretKey: null,
        awsSessionToken: undefined,
      }
    );

    expect(fromNodeProviderChainMock).toHaveBeenCalledTimes(1);
    expect(SignatureV4Mock).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: chainCredentials })
    );
  });

  it("should handle missing headers in request", async () => {
    const req: RequestInit = {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
    };
    mockSigner();

    const headers = await getAwsAuthorizationHeaders(req, staticKeyProps);
    expect(headers).toEqual({ Authorization: "signed-header-value" });
  });

  it("should handle additional headers iteration", async () => {
    const req: RequestInit = {
      method: "GET",
      headers: new Headers({ "custom-header": "value" }),
    };
    mockSigner();

    const headers = await getAwsAuthorizationHeaders(req, staticKeyProps);
    expect(headers).toEqual({ Authorization: "signed-header-value" });
  });

  it("should delete connection header if present", async () => {
    const req: RequestInit = {
      method: "PUT",
      headers: { connection: "keep-alive" },
    };
    const mockSign = mockSigner();

    const headers = await getAwsAuthorizationHeaders(req, staticKeyProps);
    expect(headers).toEqual({ Authorization: "signed-header-value" });
    expect(mockSign).toHaveBeenCalled();
    const reqArgs = mockSign.mock.calls[0][0];
    expect(reqArgs.headers.connection).toBeUndefined();
  });

  it("should throw an error when URL is missing", async () => {
    await expect(
      getAwsAuthorizationHeaders(
        { method: "GET" },
        { ...staticKeyProps, url: "" }
      )
    ).rejects.toThrow("URL and region name are required for AWS authorization");
  });

  it("should throw an error when region name is missing", async () => {
    await expect(
      getAwsAuthorizationHeaders(
        { method: "GET" },
        { ...staticKeyProps, regionName: "" }
      )
    ).rejects.toThrow("URL and region name are required for AWS authorization");
  });

  it("throws LlmExeError with auth.aws_signing_input_missing when url or region missing", async () => {
    try {
      await getAwsAuthorizationHeaders(
        { method: "GET" },
        {
          url: "",
          regionName: "us-east-1",
          awsAccessKey: "x",
          awsSecretKey: "y",
          awsSessionToken: undefined,
        }
      );
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("auth.aws_signing_input_missing");
      expect((e as LlmExeError).category).toBe("auth");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("getAwsAuthorizationHeaders");
      expect(ctx.url).toBe("");
      expect(ctx.regionName).toBe("us-east-1");
    }
  });
});
