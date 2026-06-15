import { LlmProviderKey, OutputResult } from "./llm";

export type LlmProvider =
  | "openai.chat"
  | "openai.embedding"
  | "google.embedding"
  | "openai.chat-mock"
  | "anthropic.chat"
  | "amazon:anthropic.chat"
  | "amazon:meta.chat"
  | "amazon:nova.chat"
  | "amazon.embedding"
  | "amazon:cohere.embedding"
  | "xai.chat"
  | "google.chat"
  | "ollama.chat"
  | "deepseek.chat";

export interface Config<Pk = LlmProviderKey> {
  /**
   * Unique identifier for this configuration (e.g., "openai.chat.v1", "anthropic.claude-3-opus")
   * Used to reference this config when calling useLlm()
   */
  key: Pk;

  /**
   * The provider type this config is for (e.g., "openai.chat", "anthropic.chat")
   * Used internally for provider-specific logic
   */
  provider: LlmProvider;

  /**
   * HTTP method for the API request (typically "POST" for LLM providers)
   */
  method: "POST" | "PUT" | "GET";

  /**
   * API endpoint URL template. Supports template variables using {{variable}} syntax
   * Variables are replaced with values from the state object
   * @example "https://api.openai.com/v1/chat/completions"
   * @example "https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke"
   */
  endpoint: string;

  /**
   * HTTP headers template as a JSON string. Supports template variables using {{variable}} syntax
   * @example '{"Authorization":"Bearer {{openAiApiKey}}", "Content-Type": "application/json"}'
   * // TODO: make this also accept object and function
   */
  headers: string;
  options: {
    [key in string]: {
      /**
       * Default value for this parameter if not provided by the user
       * Can be a static value or a function that returns the value
       * @example 4096
       * @example () => process.env.OPENAI_API_KEY
       */
      default?: any;

      /**
       * Whether this parameter is required
       * [true, "error message"] - Required with custom error
       * [true] - Required with default error message
       * @example [true, "maxTokens is required for Anthropic"]
       */
      required?: [boolean, string] | [boolean];
    };
  };
  mapBody: {
    [key in string]: {
      /**
       * The target field name in the provider's request body.
       * Supports dot notation for nested fields (e.g., "response_format.type")
       */
      key: string;

      /**
       * Default value to use if the source field is not provided
       */
      default?: any;

      /**
       * Transform function to convert the value before mapping to the request body
       * @param value - The input value from the user's state
       * @param state - The complete user state object containing all parameters
       * @param config - The current Config object (for access to options, etc.)
       * @returns The transformed value to be included in the request body
       */
      transform?: (
        value: any,
        state: Record<string, any>,
        config: Record<string, any>,
      ) => any;
    };
  };
  /**
   * Maps executor-level options (jsonSchema, functions, functionCall) to provider-specific request formats
   * @optional - Only needed if provider supports these features
   */
  mapOptions?: {
    /**
     * Transform JSON schema into provider-specific format
     * @param schema - The JSON schema object
     * @param options - Executor options (e.g., functionCallStrictInput)
     * @param currentInput - Current accumulated input state (for merging)
     * @param config - The full config object
     * @returns Provider-specific request body additions
     */
    jsonSchema?: (
      schema: any,
      options: any,
      currentInput?: Record<string, any>,
      config?: Config,
    ) => Record<string, any>;

    /**
     * Transform function call mode into provider-specific format
     * @param call - Function call mode ("auto", "any", "none", or specific function)
     * @param options - Executor options
     * @param currentInput - Current accumulated input state (for merging)
     * @param config - The full config object
     * @returns Provider-specific request body additions
     */
    functionCall?: (
      call: any,
      options?: any,
      currentInput?: Record<string, any>,
      config?: Config,
    ) => Record<string, any>;

    /**
     * Transform function definitions into provider-specific format
     * @param functions - Array of function definitions
     * @param options - Executor options (e.g., functionCallStrictInput)
     * @param currentInput - Current accumulated input state (for merging)
     * @param config - The full config object
     * @returns Provider-specific request body additions
     */
    functions?: (
      functions: any[],
      options?: any,
      currentInput?: Record<string, any>,
      config?: Config,
    ) => Record<string, any>;
  };
  /**
   * Optional response transformer for chat/LLM configs. The LLM call path
   * (`llm.call.ts`) defaults to `OutputDefault` when this is omitted.
   * Embedding configs do not use this — their flow dispatches via
   * `getEmbeddingOutputParser` instead.
   */
  transformResponse?: (
    result: any,
    _config?: Config<any>,
    headers?: Record<string, string>,
  ) => OutputResult;
  /**
   * Marks this config as deprecated. When set, useLlm() will emit a one-time
   * deprecation warning to inform users about upcoming model shutdowns.
   */
  deprecated?: {
    shorthand: string;
    message: string;
  };
}
