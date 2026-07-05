import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@smithy/signature-v4";
import { HttpRequest } from "@smithy/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";
import { LlmExeError } from "@/errors";

type AuthProps = {
  url: string;
  regionName: string;
  awsAccessKey: string | null | undefined;
  awsSecretKey: string | null | undefined;
  awsSessionToken: string | null | undefined;
};

export async function getAwsAuthorizationHeaders(
  req: RequestInit,
  props: AuthProps
): Promise<Record<string, string>> {
  // Validate required inputs early to fail fast
  if (!props.url || !props.regionName) {
    throw new LlmExeError(
      "URL and region name are required for AWS authorization",
      {
        code: "auth.aws_signing_input_missing",
        context: {
          operation: "getAwsAuthorizationHeaders",
          url: props.url,
          regionName: props.regionName,
          expected: "both url and regionName to be set",
          resolution:
            "Set AWS_REGION as an environment variable (or pass regionName) and provide a valid request URL.",
        },
      }
    );
  }
  
  // Explicit per-call keys go straight to the signer as a static credentials
  // object. Routing them through fromNodeProviderChain required mutating
  // process.env, which is process-global: concurrent calls with different
  // keys could sign with each other's credentials. The provider chain is only
  // consulted when no explicit key pair is configured (partial pairs are
  // ignored — an access key without a secret cannot sign anything), so it
  // reads the real, untouched environment.
  const credentials =
    props.awsAccessKey && props.awsSecretKey
      ? {
          accessKeyId: props.awsAccessKey,
          secretAccessKey: props.awsSecretKey,
          ...(props.awsSessionToken
            ? { sessionToken: props.awsSessionToken }
            : {}),
        }
      : await fromNodeProviderChain()();

  const signer = new SignatureV4({
    service: "bedrock",
    region: props.regionName,
    credentials,
    sha256: Sha256,
  });

  const url = new URL(props.url);

  const headers: Record<string, any> = !req.headers
    ? {}
    : Symbol.iterator in req.headers
    ? Object.fromEntries(Array.from(req.headers).map((header) => [...header]))
    : { ...req.headers };

  // The connection header may be stripped by a proxy somewhere, so the receiver
  // of this message may not see this header, so we remove it from the set of headers
  // that are signed.
  delete headers["connection"];
  headers["host"] = url.hostname;

  const request = new HttpRequest({
    method: req?.method?.toUpperCase(),
    protocol: url.protocol,
    path: url.pathname,
    body: req.body,
    headers,
  });

  const signed = await signer.sign(request);
  return signed.headers;
}
