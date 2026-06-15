import { replaceTemplateStringSimple } from "@/utils/modules/replaceTemplateStringSimple";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import { getAwsAuthorizationHeaders } from "@/utils/modules/getAwsAuthorizationHeaders";
import { Config, EmbeddingProviderKey, LlmProviderKey } from "@/types";
import { LlmExeError } from "@/errors";
import { redactSecrets } from "@/utils/modules/redactSecrets";

const REPLACED_HEADERS_EXCERPT_MAX = 500;

function safeReplacedHeaders(value: string | undefined | null): string {
  if (!value) return "";
  const truncated =
    value.length > REPLACED_HEADERS_EXCERPT_MAX
      ? value.slice(0, REPLACED_HEADERS_EXCERPT_MAX) + "…(truncated)"
      : value;
  return redactSecrets(truncated);
}

export async function parseHeaders(
  config: Config<EmbeddingProviderKey | LlmProviderKey>,
  replacements: Record<string, any>,
  payload: { url: string; headers: Record<string, any>; body: string }
): Promise<Record<string, any>> {
  const replace = replaceTemplateStringSimple(config.headers, replacements);
  
  let parsedHeaders: Record<string, any> = {};
  if (replace) {
    try {
      parsedHeaders = JSON.parse(replace);
      
      // Validate that the parsed result is an object
      if (typeof parsedHeaders !== 'object' || parsedHeaders === null || Array.isArray(parsedHeaders)) {
        throw new Error('Headers must be a JSON object');
      }
    } catch (error) {
      // Provide detailed error context for debugging header configuration issues.
      // The post-replacement string contains real header values (Authorization,
      // x-api-key, AWS credentials), so it must be redacted before going into
      // the message or context where it can land in logs / error reporters.
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const safeReplaced = safeReplacedHeaders(replace);
      throw new LlmExeError(
        `Failed to parse headers configuration: ${errorMessage}. ` +
        `Headers template: "${config.headers}". ` +
        `After replacement: "${safeReplaced}"`,
        {
          code: "configuration.invalid_headers",
          context: {
            operation: "parseHeaders",
            provider: config.provider,
            key: config.key,
            headerTemplate: config.headers,
            replacedHeadersExcerpt: safeReplaced,
            resolution:
              "Fix the headers template so replacement produces a JSON object.",
          },
          cause: error,
        }
      );
    }
  }
  
  const headers = Object.assign({}, payload.headers, parsedHeaders);

  if (
    config.provider.startsWith("amazon:") ||
    config.provider.startsWith("amazon.")
  ) {
    const url = payload.url;
    return getAwsAuthorizationHeaders(
      {
        method: config.method,
        headers: headers,
        body: payload.body,
      },
      {
        url: url,
        regionName:
          replacements?.awsRegion || getEnvironmentVariable("AWS_REGION"),
        awsSecretKey: replacements.awsSecretKey,
        awsAccessKey: replacements.awsAccessKey,
      } as any
    );
  } else {
    return headers;
  }
}
