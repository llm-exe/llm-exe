export type TextPromptType = "text";
export type ChatPromptType = "chat";
export type PromptType = TextPromptType | ChatPromptType;

export type PromptHelper = { name: string; handler: (args: any) => any };
export type PromptPartial = { name: string; template: string };
export type ValidateInputMode = false | "strict" | "warn";
export interface PromptTemplateOptions {
  partials?: PromptPartial[];
  helpers?: PromptHelper[];
}

export interface PromptOptions extends PromptTemplateOptions {
  preFilters?: ((prompt: string) => string)[];
  postFilters?: ((prompt: string) => string)[];
  replaceTemplateString?: (...args: any[]) => string;
  /**
   * Controls whether `format()` preflights input against the variables
   * referenced by the prompt's templates. See `validate(input)`.
   *
   * - `false` (default): no preflight; rendering proceeds.
   * - `"strict"`: throw `LlmExeError("prompt.missing_template_variable")` before rendering.
   * - `"warn"`: emit a Node warning via `process.emitWarning` and continue rendering.
   */
  validateInput?: ValidateInputMode;
}

export interface ChatPromptOptions extends PromptOptions {
  allowUnsafeUserTemplate?: boolean;
}
