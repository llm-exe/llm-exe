export type JsonSafe =
  | string
  | number
  | boolean
  | null
  | JsonSafe[]
  | { [key: string]: JsonSafe };

export type ErrorCategory =
  | "unknown"
  | "configuration"
  | "llm"
  | "embedding"
  | "prompt"
  | "parser"
  | "executor"
  | "callable"
  | "state"
  | "request"
  | "auth"
  | "template"
  | "internal";

export type BaseErrorContext = {
  operation?: string;
  provider?: string;
  model?: string;
  key?: string;
  input?: unknown;
  output?: unknown;
  response?: unknown;
  status?: number;
  url?: string;
  parser?: string;
  promptType?: string;
  functionName?: string;
  hook?: string;
  expected?: unknown;
  received?: unknown;
  resolution?: string;
  docsPath?: string;
  docsUrl?: string;
};

export type ConfigurationProviderContext = BaseErrorContext & {
  provider?: string;
  availableProviders?: string[];
};

export type MissingConfigurationContext = BaseErrorContext & {
  provider?: string;
  key?: string;
  option?: string;
  envVar?: string;
};

export type InvalidHeadersContext = BaseErrorContext & {
  provider?: string;
  key?: string;
  headerTemplate?: string;
  replacedHeadersExcerpt?: string;
};

export type ParserInvalidTypeContext = BaseErrorContext & {
  parser?: unknown;
  availableParsers?: string[];
};

export type ParserSchemaValidationContext = BaseErrorContext & {
  parser?: string;
  schemaErrors?: unknown;
  outputExcerpt?: string;
};

// Shared context for parser.invalid_input and parser.parse_failed.
// `reason` is a diagnostic sub-cause (empty_input, invalid_json,
// no_code_block, etc.). Users branch on `code`; logs/debug inspect `reason`.
export type ParserParseFailedContext = BaseErrorContext & {
  parser?: string;
  reason?: string;
  inputExcerpt?: string;
  inputExcerptTruncated?: boolean;
  inputLength?: number;
  matchCount?: number;
  match?: string;
  outputExcerpt?: string;
};

export type PromptInputContext = BaseErrorContext & {
  promptType?: string;
};

export type PromptMessagesContext = BaseErrorContext & {
  provider?: string;
};

export type PromptMissingTemplateVariableContext = BaseErrorContext & {
  promptType?: string;
  missingVariables: string[];
  missingHelpers: string[];
};

export type NormalizedProviderError = {
  message?: string;
  providerType?: string;
  providerCode?: string;
  status?: number;
  statusText?: string;
  retryable?: boolean;
  retryAfterMs?: number;
};

export type ProviderErrorContext = BaseErrorContext & {
  provider?: string;
  model?: string;
  status?: number;
  statusText?: string;
  url?: string;
  providerError?: NormalizedProviderError;
  providerErrorBody?: unknown;
  providerErrorRaw?: string;
  responseHeaders?: Record<string, string>;
};

export type ProviderResponseContext = BaseErrorContext & {
  provider?: string;
  model?: string;
  responseExcerpt?: string;
  lineNumber?: number;
  lineExcerpt?: string;
  lineCount?: number;
  availableProviders?: string[];
};

export type EmbeddingDimensionsContext = BaseErrorContext & {
  provider?: string;
  model?: string;
  dimensions?: number;
};

export type ExecutorErrorContext = BaseErrorContext & {
  executorName?: string;
  executorType?: string;
  traceId?: string;
};

export type ExecutorHookContext = ExecutorErrorContext & {
  hook?: string;
  hookCount?: number;
  maxHooksPerEvent?: number;
};

export type CallableErrorContext = BaseErrorContext & {
  functionName?: string;
  availableFunctions?: string[];
};

export type TemplateHelperContext = BaseErrorContext & {
  helper?: string;
};

export type StateErrorContext = BaseErrorContext & {
  module?: string;
};

export type AwsAuthContext = BaseErrorContext & {
  url?: string;
  regionName?: string;
};

export type RequestErrorContext = BaseErrorContext & {
  url?: string;
  status?: number;
  statusText?: string;
  providerError?: NormalizedProviderError;
  providerErrorBody?: unknown;
  providerErrorRaw?: string;
  responseHeaders?: Record<string, string>;
};

export type InternalErrorContext = BaseErrorContext & {
  invariant?: string;
};

export type ErrorContextByCode = {
  "configuration.missing_provider": ConfigurationProviderContext;
  "configuration.invalid_provider": ConfigurationProviderContext;
  "configuration.missing_env": MissingConfigurationContext;
  "configuration.missing_option": MissingConfigurationContext;
  "configuration.invalid_headers": InvalidHeadersContext;
  "parser.invalid_type": ParserInvalidTypeContext;
  "parser.invalid_input": ParserParseFailedContext;
  "parser.parse_failed": ParserParseFailedContext;
  "parser.schema_validation_failed": ParserSchemaValidationContext;
  "prompt.missing_input": PromptInputContext;
  "prompt.invalid_messages": PromptMessagesContext;
  "prompt.missing_template_variable": PromptMissingTemplateVariableContext;
  "llm.provider_http_error": ProviderErrorContext;
  "llm.provider_rate_limited": ProviderErrorContext;
  "llm.provider_auth_failed": ProviderErrorContext;
  "llm.provider_invalid_request": ProviderErrorContext;
  "llm.provider_unavailable": ProviderErrorContext;
  "llm.invalid_response_shape": ProviderResponseContext;
  "llm.invalid_jsonl_response": ProviderResponseContext;
  "embedding.provider_http_error": ProviderErrorContext;
  "embedding.provider_rate_limited": ProviderErrorContext;
  "embedding.provider_auth_failed": ProviderErrorContext;
  "embedding.provider_invalid_request": ProviderErrorContext;
  "embedding.provider_unavailable": ProviderErrorContext;
  "embedding.missing_provider": ConfigurationProviderContext;
  "embedding.invalid_provider": ConfigurationProviderContext;
  "embedding.unsupported_dimensions": EmbeddingDimensionsContext;
  "embedding.invalid_response_shape": ProviderResponseContext;
  "executor.missing_prompt": ExecutorErrorContext;
  "executor.hook_limit_reached": ExecutorHookContext;
  "executor.hook_failed": ExecutorHookContext;
  "callable.invalid_handler": CallableErrorContext;
  "callable.handler_not_found": CallableErrorContext;
  "callable.validation_failed": CallableErrorContext;
  "template.invalid_helper_arguments": TemplateHelperContext;
  "state.invalid_arguments": StateErrorContext;
  "auth.aws_signing_input_missing": AwsAuthContext;
  "request.invalid_url": RequestErrorContext;
  "request.http_error": RequestErrorContext;
  "internal.invariant_failed": InternalErrorContext;
  "unknown.unclassified": Record<string, unknown>;
};

export type ErrorCodes = keyof ErrorContextByCode;

export type CategoryFor<C extends ErrorCodes> =
  C extends `${infer Category}.${string}` ? Category & ErrorCategory : never;

export type SerializableCause =
  | {
      name?: string;
      message?: string;
      category?: string;
      code?: string;
      context?: unknown;
      cause?: unknown;
    }
  | JsonSafe;

export type LlmExeErrorOptions<C extends ErrorCodes = ErrorCodes> = {
  code: C;
  context?: ErrorContextByCode[C];
  cause?: unknown;
};

export type LlmExeErrorJson<C extends ErrorCodes = ErrorCodes> = {
  name: "LlmExeError";
  message: string;
  category: CategoryFor<C>;
  code: C;
  context?: ErrorContextByCode[C];
  cause?: SerializableCause;
  truncated?: boolean;
};

export type SerializeOptions = {
  includeStack?: boolean;
};
