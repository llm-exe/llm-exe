import { IChatMessageRole } from "./chat";
import { PromptType } from "./prompt";

interface OutputOpenAIChatChoiceBase {
  message: {
    role: Extract<IChatMessageRole, "assistant">;
    content: string | null;
    tool_calls:
      | null
      | {
          type: "function";
          function: {
            name: string;
            arguments: string;
          };
        }[];
  };
  finish_reason: "tool_calls" | "stop";

  reasoning_effort: "minimal" | "low" | "medium" | "high";
}

export interface OutputOpenAIChatChoiceFunction
  extends OutputOpenAIChatChoiceBase {
  message: {
    role: Extract<IChatMessageRole, "assistant">;
    content: string | null;
    tool_calls: {
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }[];
    refusal: null;
    annotations: any[];
  };
  finish_reason: Extract<"tool_calls" | "stop", "tool_calls">;
}

export interface OutputOpenAIChatChoiceMessage
  extends OutputOpenAIChatChoiceBase {
  message: {
    role: Extract<IChatMessageRole, "assistant">;
    content: string;
    tool_calls: null;
  };
  finish_reason: Exclude<"tool_calls" | "stop", "tool_calls">;
}

export type OutputOpenAIChatChoice =
  | OutputOpenAIChatChoiceFunction
  | OutputOpenAIChatChoiceMessage;

export interface OpenAiResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;

    prompt_tokens_details: {
      cached_tokens: number;
      audio_tokens: number;
    };
    completion_tokens_details: {
      reasoning_tokens: number;
      audio_tokens: number;
      accepted_prediction_tokens: number;
      rejected_prediction_tokens: number;
    };
  };
  service_tier: "default";
  choices: OutputOpenAIChatChoice[];
}

/**
 * Claude
 */
export interface Claude2Request {
  prompt: string;
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens_to_sample: number;
  stop_sequences: string[];
  metadata: Record<string, any>;
  stream: boolean;
}

export interface Claude2Response {
  completion: string;
  id: string;
  model: string;
  stop_reason: "stop_sequence";
  type: "completion";
}

export interface Claude3Response {
  id: string;
  type: string;
  role: "assistant";
  content: (
    | {
        // id: string; // i don't think this exists?
        type: "text";
        text: string;
      }
    | {
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, any>;
      }
  )[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "pause_turn" | "refusal" | "model_context_window_exceeded";
  stop_sequence: null | string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    service_tier: "standard";
  };
}

/**
 * x.ai Grok
 */
export interface XAiResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  usage: {
    prompt_tokens: 28;
    completion_tokens: 5;
    total_tokens: 33;
    prompt_tokens_details: {
      text_tokens: 28;
      audio_tokens: 0;
      image_tokens: 0;
      cached_tokens: 0;
    };
  };
  choices: OutputOpenAIChatChoice[];
}

/**
 * Llama
 */
export interface MetaLlama2Request {
  prompt: string;
  temperature: number;
  top_p: number;
  max_gen_len: number;
}

export interface MetaLlama2Response {
  generation: string;
  prompt_token_count: number;
  generation_token_count: number;
  stop_reason: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Amazon Titan
 */

export interface AmazonTitanRequest {
  inputText: string;
  textGenerationConfig: {
    temperature: number;
    topP: number;
    maxTokenCount: number;
    stopSequences: string[];
  };
}

export interface AmazonTitalResponse {
  inputTextTokenCount: number;
  results: [
    {
      tokenCount: number;
      outputText: string;
      completionReason: string;
    },
  ];
}

/**
 * Gemini
 * this is how we're expecting Gemini responses to look like
 */
interface OutputGoogleGeminiChatChoiceBase {
  content: {
    role?: Extract<IChatMessageRole, "model">;
    parts: {
      text?: string;
      functionCall?: null | {
        name: string;
        args: Record<string, any>;
      };
    }[];
  };
  finishReason:
    | "STOP"
    | "MAX_TOKENS"
    | "SAFETY"
    | "RECITATION"
    | "OTHER"
    | "BLOCKLIST"
    | "PROHIBITED_CONTENT"
    | "SPII"
    | "MALFORMED_FUNCTION_CALL";
  avgLogprobs?: number;
  safetyRatings?: {
    category: string;
    probability: string;
    probabilityScore?: number;
    severity?: string;
    severityScore?: number;
  }[];
  citationMetadata?: {
    citations: {
      startIndex?: number;
      endIndex?: number;
      uri?: string;
      title?: string;
      license?: string;
      publicationDate?: {
        year?: number;
        month?: number;
        day?: number;
      };
    }[];
  };
}

export interface OutputGoogleGeminiChatChoiceFunction
  extends OutputGoogleGeminiChatChoiceBase {
  content: {
    role?: Extract<IChatMessageRole, "model">;
    parts: {
      text: undefined;
      functionCall?: {
        name: string;
        args: Record<string, any>;
      };
    }[];
  };
}

export interface OutputGoogleGeminiChatChoiceMessage
  extends OutputGoogleGeminiChatChoiceBase {
  content: {
    role?: Extract<IChatMessageRole, "model">;
    parts: {
      text: string;
      functionCall?: null;
    }[];
  };
}

export type OutputGoogleGeminiChatChoice =
  | OutputGoogleGeminiChatChoiceFunction
  | OutputGoogleGeminiChatChoiceMessage;

export interface GoogleGeminiResponse {
  model?: string;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    promptTokensDetails?: {
      modality: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
      tokenCount: number;
    }[];
    candidatesTokensDetails?: {
      modality: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
      tokenCount: number;
    }[];
  };
  candidates: OutputGoogleGeminiChatChoice[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: {
      category: string;
      probability: string;
      probabilityScore?: number;
      severity?: string;
      severityScore?: number;
    }[];
  };
  modelVersion: string;
  responseId: string;
}
// END Gemini

/**
 * Internal Formats
 */

// This is our internal result format base
// this is the normalized responses from any llm
// we convert to this format and internally expect it
export interface OutputResultsBase {
  type: "text" | "function_use";
  text?: string;
}

// Storing text-based llm response
export interface OutputResultsText extends OutputResultsBase {
  type: "text";
  text: string;
}

// Storing function-based llm response
export interface OutputResultsFunction extends OutputResultsBase {
  type: "function_use";
  name: string;
  input: Record<string, any>;

  // new
  functionId: string;
}

export type OutputResultContent = OutputResultsText | OutputResultsFunction;

export interface OutputResult {
  id: string;
  name?: string;
  created: number;
  stopReason: string;
  content: OutputResultContent[];
  options?: OutputResultContent[][];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  // TODO: add metadata
}

export interface EmbeddingOutputResult {
  id: string;
  model?: string;
  created: number;
  embedding: number[][];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export interface BaseLlmOptions {
  traceId?: null | string;
  timeout?: number;
  maxDelay?: number;
  numOfAttempts?: number;
  jitter?: "none" | "full";
  promptType?: PromptType;

  // New options for custom endpoints
  endpoint?: string;
  headers?: Record<string, string>;
}

/**
 * A single interleaved text + image request entry, as accepted by Cohere
 * Embed v4 (Bedrock request body field `inputs`). The provider fuses every
 * part of `content` into ONE vector, which is the whole point: a caption and
 * its image become a single searchable embedding.
 *
 * `image_url.url` must be a complete data URI, e.g.
 * "data:image/png;base64,iVBORw0KGgo...". A remote http(s) URL is NOT
 * accepted by Bedrock; fetch the bytes and inline them.
 */
export interface EmbeddingContentItem {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
}

/**
 * Accepted embedding input. A `string` or `string[]` is a plain text batch and
 * is supported by every embedding provider. An `EmbeddingContentItem[]` is a
 * multimodal batch and is supported ONLY by "amazon:cohere.embedding.v1";
 * other providers throw `embedding.unsupported_input`.
 */
export type EmbeddingInput = string | string[] | EmbeddingContentItem[];

export interface GenericEmbeddingOptions extends BaseLlmOptions {
  model?: string;
  input?: EmbeddingInput;
  dimensions?: number;
}

export interface OpenAiEmbeddingOptions extends GenericEmbeddingOptions {
  model?: string;
  openAiApiKey?: string;
  // Base URL for any OpenAI-compatible embeddings server
  // Defaults to https://api.openai.com/v1
  baseUrl?: string;
}

export interface AmazonEmbeddingOptions extends GenericEmbeddingOptions {
  model: string;
  awsRegion?: string;
  awsSecretKey?: string;
  awsAccessKey?: string;
}

export interface CohereBedrockEmbeddingOptions
  extends AmazonEmbeddingOptions {
  inputType?:
    | "search_document"
    | "search_query"
    | "classification"
    | "clustering";
  truncate?: "NONE" | "START" | "END" | "LEFT" | "RIGHT";
  /**
   * Escape hatch that writes Cohere Embed v4's `inputs` request field
   * directly. Normally you do not set this: pass an EmbeddingContentItem[]
   * as the call input instead, and the config routes it to `inputs` for you.
   * A multimodal call input takes precedence over this value.
   */
  imageInputs?: EmbeddingContentItem[];
}

// Embed v3 returns `embeddings` as a plain array (response_type
// "embeddings_floats"); Embed v4 returns it keyed by embedding type
// (response_type "embeddings_by_type").
export interface CohereBedrockEmbeddingsByType {
  float?: number[][];
  int8?: number[][];
  uint8?: number[][];
  binary?: number[][];
  ubinary?: number[][];
}

export interface CohereBedrockEmbeddingApiResponseOutput {
  id?: string;
  response_type?: string;
  embeddings: number[][] | CohereBedrockEmbeddingsByType;
  texts?: string[];
}

// theirs
export interface OpenAiEmbeddingApiRequestInput {
  input: string;
  model: string;
  encoding_format?: string;
  dimensions?: number;
  user?: string;
}

// theirs
export interface OpenAiEmbeddingApiResponseOutput {
  object: string;
  data: {
    object: string;
    embedding: number[];
    index: number;
  }[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface AmazonTitanEmbeddingApiResponseOutput {
  embedding: number[];
  inputTextTokenCount: number;
}

export interface GenericLLm extends BaseLlmOptions {
  model?: string;
  system?: string;
  prompt?: string | { role: string; content: string }[];
  temperature?: number;
  topP?: number;
  stream?: boolean;
  streamOptions?: Record<string, any>;
  maxTokens?: number;
  stopSequences?: string[];

  effort?: "minimal" | "low" | "medium" | "high";
}

export interface OpenAiRequest extends GenericLLm {
  model: string;
  frequencyPenalty?: number;
  logitBias?: Record<string, any> | null;
  responseFormat?: Record<string, any>;
  openAiApiKey?: string;
  useJson?: boolean;
}

export interface XAiRequest extends GenericLLm {
  model: string;
  frequencyPenalty?: number;
  logitBias?: Record<string, any> | null;
  responseFormat?: Record<string, any>;
  xAiApiKey?: string;
  useJson?: boolean;
}

export interface AmazonBedrockRequest extends GenericLLm {
  model: string;
  awsRegion?: string;
  awsSecretKey?: string;
  awsAccessKey?: string;
}

export interface AnthropicRequest extends GenericLLm {
  model: string;
  anthropicApiKey?: string;
  // Anthropic-specific parameters
  topK?: number; // Only sample from the top K options for each subsequent token
  metadata?: {
    user_id?: string;
  };
  serviceTier?: "auto" | "standard_only"; // Determines whether to use priority capacity
}

export interface GeminiRequest extends GenericLLm {
  model: string;
  geminiApiKey?: string;
}

export interface DeepseekRequest extends GenericLLm {
  model: string;
  responseFormat?: Record<string, any>;
  deepseekApiKey?: string;
  useJson?: boolean;
}

export type AllEmbedding = {
  "openai.embedding.v1": {
    input: OpenAiEmbeddingOptions;
    // output: OpenAiRequest;
  };
  "amazon.embedding.v1": {
    input: AmazonEmbeddingOptions;
  };
  "amazon:cohere.embedding.v1": {
    input: CohereBedrockEmbeddingOptions;
  };
};

export type AllLlm = {
  "openai.chat.v1": {
    input: OpenAiRequest;
    // output: OpenAiRequest;
  };
  "openai.chat-mock.v1": {
    input: OpenAiRequest;
    // output: OpenAiRequest;
  };
  "anthropic.chat.v1": {
    input: AnthropicRequest;
    // output: Claude3Response;
  };
  "amazon:anthropic.chat.v1": {
    input: AnthropicRequest & AmazonBedrockRequest;
    // output: OpenAiRequest;
  };
  "amazon:meta.chat.v1": {
    input: AmazonBedrockRequest;
    // output: OpenAiRequest;
  };
  // "amazon:nova.chat.v1": {
  //   input: AmazonBedrockRequest;
  //   // output: OpenAiRequest;
  // };
  "xai.chat.v1": {
    input: XAiRequest;
    // output: OpenAiRequest;
  };
  "ollama.chat.v1": {
    input: GenericLLm;
    // output: OpenAiRequest;
  };
  "google.chat.v1": {
    input: GeminiRequest;
    // output: OpenAiRequest;
  };
  "deepseek.chat.v1": {
    input: DeepseekRequest;
    // output: OpenAiRequest;
  };
};

export type AllUseLlmOptions = AllLlm & {
  // OpenAI - GPT-5 family
  "openai.gpt-5.6": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5.6-terra": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5.6-luna": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5.5": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5.4": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5.4-mini": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5.2": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5-mini": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-5-nano": {
    input: Omit<OpenAiRequest, "model">;
  };
  // OpenAI - GPT-4.1 family
  "openai.gpt-4.1": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-4.1-mini": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-4.1-nano": {
    input: Omit<OpenAiRequest, "model">;
  };
  // OpenAI - Reasoning models
  "openai.o3": {
    input: Omit<OpenAiRequest, "model">;
  };
  // OpenAI - GPT-4o family
  "openai.gpt-4": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-4o": {
    input: Omit<OpenAiRequest, "model">;
  };
  "openai.gpt-4o-mini": {
    input: Omit<OpenAiRequest, "model">;
  };
  // OpenAI - Deprecated
  "openai.o4-mini": {
    input: Omit<OpenAiRequest, "model">;
  };

  // Anthropic - Claude Fable 5 models
  "anthropic.claude-fable-5": {
    input: Omit<AnthropicRequest, "model">;
  };

  // Anthropic - Claude Opus 5 models
  "anthropic.claude-opus-5": {
    input: Omit<AnthropicRequest, "model">;
  };

  // Anthropic - Claude 4.8 models
  "anthropic.claude-opus-4-8": {
    input: Omit<AnthropicRequest, "model">;
  };

  // Anthropic - Claude Sonnet 5 models
  "anthropic.claude-sonnet-5": {
    input: Omit<AnthropicRequest, "model">;
  };

  // Anthropic - Claude 4.7 models
  "anthropic.claude-opus-4-7": {
    input: Omit<AnthropicRequest, "model">;
  };

  // Anthropic - Claude 4.6 models
  "anthropic.claude-sonnet-4-6": {
    input: Omit<AnthropicRequest, "model">;
  };

  // Anthropic - Claude 4.5 models
  "anthropic.claude-opus-4-5": {
    input: Omit<AnthropicRequest, "model">;
  };
  "anthropic.claude-haiku-4-5": {
    input: Omit<AnthropicRequest, "model">;
  };
  "anthropic.claude-sonnet-4-5": {
    input: Omit<AnthropicRequest, "model">;
  };
  
  // Anthropic - Deprecated
  "anthropic.claude-opus-4-6": {
    input: Omit<AnthropicRequest, "model">;
  };
  // Removed: Claude Opus 4 / Sonnet 4 (claude-opus-4-0, claude-sonnet-4-0) are
  // retired at Anthropic (HTTP 404). The claude-*-4-0 keys were type-only orphans
  // with no runtime shorthand and threw "Invalid provider" if used.
  "anthropic.claude-3-7-sonnet": {
    input: Omit<AnthropicRequest, "model">;
  };
  "anthropic.claude-3-5-sonnet": {
    input: Omit<AnthropicRequest, "model">;
  };
  "anthropic.claude-3-5-haiku": {
    input: Omit<AnthropicRequest, "model">;
  };
  "anthropic.claude-3-opus": {
    input: Omit<AnthropicRequest, "model">;
  };
  // Google
  "google.gemini-2.5-flash": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-2.5-flash-lite": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-2.5-pro": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-3.1-flash-lite": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-3.5-flash": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-3.5-flash-lite": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-3.6-flash": {
    input: Omit<GeminiRequest, "model">;
  };
  // Google - Deprecated
  "google.gemini-2.0-flash": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-2.0-flash-lite": {
    input: Omit<GeminiRequest, "model">;
  };
  "google.gemini-1.5-pro": {
    input: Omit<GeminiRequest, "model">;
  };

  // xAI
  "xai.grok-2": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-3": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-3-mini": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4-fast": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4-1-fast": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4.3": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4.20": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4.20-reasoning": {
    input: Omit<XAiRequest, "model">;
  };
  "xai.grok-4.5": {
    input: Omit<XAiRequest, "model">;
  };

  // Ollama
  "ollama.deepseek-r1": {
    input: GenericLLm;
  };
  "ollama.llama3.3": {
    input: GenericLLm;
  };
  "ollama.llama3.2": {
    input: GenericLLm;
  };
  "ollama.llama3.1": {
    input: GenericLLm;
  };
  "ollama.qwq": {
    input: GenericLLm;
  };
  "ollama.gemma3": {
    input: GenericLLm;
  };
  "ollama.mistral": {
    input: GenericLLm;
  };
  "ollama.qwen2.5": {
    input: GenericLLm;
  };
  "ollama.qwen3": {
    input: GenericLLm;
  };
  "ollama.qwen3.5": {
    input: GenericLLm;
  };
  "ollama.gemma4": {
    input: GenericLLm;
  };
  "ollama.gpt-oss": {
    input: GenericLLm;
  };

  // Deepseek
  "deepseek.chat": {
    input: DeepseekRequest;
  };
  "deepseek.v4-flash": {
    input: Omit<DeepseekRequest, "model">;
  };
  "deepseek.v4-pro": {
    input: Omit<DeepseekRequest, "model">;
  };
};

export type LlmProviderKey = keyof AllLlm;
export type EmbeddingProviderKey = keyof AllEmbedding;
export type UseLlmKey = keyof AllUseLlmOptions;

export interface BaseLlCall {
  getResultContent: () => OutputResultContent[];
  getResultText: () => string;
  getResult: () => OutputResult;
}

export interface BaseEmbeddingCall {
  /**
   * Returns the embedding at `index` from the batch, or the first embedding
   * when `index` is omitted. Matches BaseEmbeddingOutput's implementation.
   */
  getEmbedding: (index?: number) => number[];
  getResult: () => EmbeddingOutputResult;
}

export interface BaseRequest<_T extends Record<string, any>> {
  call: (...args: any[]) => Promise<_T>;
  getTraceId: () => string | null;
  withTraceId: (traceId: string) => void;
  getMetadata: () => Record<string, any>;
}

export interface BaseLlm<_T extends BaseLlCall = BaseLlCall>
  extends BaseRequest<_T> {}
export interface BaseEmbedding<_T extends BaseEmbeddingCall = BaseEmbeddingCall>
  extends BaseRequest<_T> {}

export interface CombinedJsonLResult<T extends Record<string, any> = any> {
  result: T; // All "message.content" values concatenated;
  content: OutputResultContent; // The object containing the response metadata
  lines: T[]; // Full JSON objects from each line
}
