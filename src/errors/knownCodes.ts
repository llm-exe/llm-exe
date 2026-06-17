import type { ErrorCodes } from "./types";

const ALL_CODES = [
  "configuration.missing_provider",
  "configuration.invalid_provider",
  "configuration.missing_env",
  "configuration.missing_option",
  "configuration.invalid_headers",
  "parser.invalid_type",
  "parser.invalid_input",
  "parser.parse_failed",
  "parser.schema_validation_failed",
  "prompt.missing_input",
  "prompt.invalid_messages",
  "prompt.missing_template_variable",
  "llm.provider_http_error",
  "llm.provider_rate_limited",
  "llm.provider_auth_failed",
  "llm.provider_invalid_request",
  "llm.provider_unavailable",
  "llm.invalid_response_shape",
  "llm.invalid_jsonl_response",
  "embedding.provider_http_error",
  "embedding.provider_rate_limited",
  "embedding.provider_auth_failed",
  "embedding.provider_invalid_request",
  "embedding.provider_unavailable",
  "embedding.missing_provider",
  "embedding.invalid_provider",
  "embedding.unsupported_dimensions",
  "embedding.invalid_response_shape",
  "executor.missing_prompt",
  "executor.hook_limit_reached",
  "executor.hook_failed",
  "callable.invalid_handler",
  "callable.handler_not_found",
  "callable.validation_failed",
  "template.invalid_helper_arguments",
  "state.invalid_arguments",
  "auth.aws_signing_input_missing",
  "request.invalid_url",
  "request.http_error",
  "internal.invariant_failed",
  "unknown.unclassified",
] as const satisfies readonly ErrorCodes[];

type _MissingCode = Exclude<ErrorCodes, (typeof ALL_CODES)[number]>;
type _ExtraCode = Exclude<(typeof ALL_CODES)[number], ErrorCodes>;
const _completenessCheck: [_MissingCode, _ExtraCode] = [
  undefined as never,
  undefined as never,
];
void _completenessCheck;

export const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(ALL_CODES);
