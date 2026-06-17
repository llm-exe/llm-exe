import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";
import { replaceTemplateStringAsync } from "@/utils/modules/replaceTemplateStringAsync";
import { hbs } from "@/utils/modules/handlebars";
import {
  IChatMessages,
  PromptOptions,
  PromptType,
  PromptPartial,
  PromptHelper,
  IPromptMessages,
  IPromptChatMessages,
  ValidateInputMode,
} from "@/types";
import { LlmExeError, isLlmExeError } from "@/errors";
import {
  validateTemplateInputReferences,
  TemplateInputReference,
} from "./_templateValidation";
import { missingTemplateReferencesError } from "./errors";

/**
 * BasePrompt should be extended.
 */
export abstract class BasePrompt<I extends Record<string, any>> {
  readonly type: PromptType = "text";

  public messages: IPromptMessages | IPromptChatMessages = [];

  public partials: PromptPartial[] = [];
  public helpers: PromptHelper[] = [];

  public validateInput: ValidateInputMode = false;

  public replaceTemplateString = replaceTemplateString;
  public replaceTemplateStringAsync = replaceTemplateStringAsync;

  public filters: {
    pre: ((prompt: string) => string)[];
    post: ((prompt: string) => string)[];
  } = {
    pre: [],
    post: [],
  };

  /**
   * constructor description
   * @param initialPromptMessage An initial message to add to the prompt.
   */
  constructor(initialPromptMessage?: string, options?: PromptOptions) {
    if (initialPromptMessage) {
      this.addToPrompt(initialPromptMessage, "system");
    }

    if (options) {
      if (options.partials) {
        this.registerPartial(options.partials);
      }
      if (options.helpers) {
        this.registerHelpers(options.helpers);
      }
      if (options.preFilters && Array.isArray(options.preFilters)) {
        this.filters.pre.push(...options.preFilters);
      }
      if (options.postFilters && Array.isArray(options.postFilters)) {
        this.filters.post.push(...options.postFilters);
      }
      if (options.replaceTemplateString) {
        this.replaceTemplateString = options.replaceTemplateString;
      }
      if (options.validateInput !== undefined) {
        this.validateInput = options.validateInput;
      }
    }
  }

  /**
   * addToPrompt description
   * @param content The message content
   * @param role The role of the user. Defaults to system for base text prompt.
   * @return instance of BasePrompt.
   */
  addToPrompt(content: string, role = "system"): BasePrompt<I> {
    if (content) {
      switch (role) {
        case "system":
        default:
          this.addSystemMessage(content);
          break;
      }
    }
    return this;
  }

  /**
   * addSystemMessage description
   * @param content The message content
   * @return returns BasePrompt so it can be chained.
   */
  addSystemMessage(content: string) {
    this.messages.push({
      role: "system",
      content,
    });
    return this;
  }

  /**
   * registerPartial description
   * @param partialOrPartials Additional partials that can be made available to the template parser.
   * @return BasePrompt so it can be chained.
   */
  registerPartial(partialOrPartials: PromptPartial | PromptPartial[]) {
    const partials = Array.isArray(partialOrPartials)
      ? partialOrPartials
      : [partialOrPartials];
    this.partials.push(...partials);
    return this;
  }

  /**
   * registerHelpers description
   * @param helperOrHelpers Additional helper functions that can be made available to the template parser.
   * @return BasePrompt so it can be chained.
   */
  registerHelpers(helperOrHelpers: PromptHelper | PromptHelper[]) {
    const helpers = Array.isArray(helperOrHelpers)
      ? helperOrHelpers
      : [helperOrHelpers];
    this.helpers.push(...helpers);
    return this;
  }

  /**
   * Returns the Handlebars-bearing strings that should be validated, along
   * with a location label used for error context. Subclasses with structured
   * message content (e.g. ChatPrompt) should override.
   */
  protected getTemplateContents(): { content: string; location: string }[] {
    return this.messages
      .map((message, index) => {
        if (!message.content || Array.isArray(message.content)) {
          return null;
        }
        return {
          content: message.content as string,
          location: `messages[${index}].content`,
        };
      })
      .filter(
        (entry): entry is { content: string; location: string } => entry !== null
      );
  }

  protected preflightValidate(values: I): void {
    if (this.validateInput === false || !this.validateInput) {
      return;
    }
    try {
      this.validate(values);
    } catch (error) {
      if (
        this.validateInput === "warn" &&
        isLlmExeError(error, "prompt.missing_template_variable")
      ) {
        if (
          typeof process === "object" &&
          typeof process?.emitWarning === "function"
        ) {
          process.emitWarning(error);
        }
        return;
      }
      throw error;
    }
  }

  /**
   * format description
   * @param values The message content
   * @param separator The separator between messages. defaults to "\n\n"
   * @return returns messages formatted with template replacement
   */
  format(values: I, separator: string = "\n\n"): string | IChatMessages {
    this.preflightValidate(values);
    const replacements = this.getReplacements(values);
    /* istanbul ignore next */
    const messages = this.messages
      .map((message) => {
        return message.content && !Array.isArray(message.content)
          ? this.replaceTemplateString(
              this.runPromptFilter(message.content, this.filters.pre, values),
              replacements,
              {
                partials: this.partials,
                helpers: this.helpers,
              }
            )
          : "";
      })
      .join(separator);

    return this.runPromptFilter(messages, this.filters.post, values);
  }

  /**
   * format description
   * @param values The message content
   * @param separator The separator between messages. defaults to "\n\n"
   * @return returns messages formatted with template replacement
   */
  async formatAsync(values: I, separator: string = "\n\n"): Promise<string | IChatMessages> {
    this.preflightValidate(values);
    const replacements = this.getReplacements(values);
    const _messages = await Promise.all(this.messages
      .map((message) => {
        return message.content && !Array.isArray(message.content)
          ?  this.replaceTemplateStringAsync(
              this.runPromptFilter(message.content, this.filters.pre, values),
              replacements,
              {
                partials: this.partials,
                helpers: this.helpers,
              }
            )
          : ""
      }))
    
    const messages = _messages.join(separator);
    return this.runPromptFilter(messages, this.filters.post, values)
  }

  runPromptFilter(
    prompt: string,
    filters: ((prompt: string, values: I) => string)[],
    values: I
  ): string {
    let promptValue = prompt;
    for (const filter of filters) {
      promptValue = filter(promptValue, values);
    }
    return promptValue;
  }

  getReplacements(values: I) {
    if (values === undefined || values === null) {
      throw new LlmExeError(
        "format() requires an input object. Did you forget to pass arguments?",
        {
          code: "prompt.missing_input",
          context: {
            operation: "BasePrompt.getReplacements",
            promptType: this.type,
            expected: "object",
            received: values === null ? "null" : "undefined",
            resolution: "Pass an object of template values to format().",
          },
        }
      );
    }
    const { input = "", ...restOfValues } = values;
    const replacements = Object.assign(
      {},
      { ...restOfValues },
      {
        input: input,
        _input: input,
      }
    );
    return replacements;
  }

  /**
   * Validates that `input` provides every variable referenced by this prompt's
   * templates, and that every identifiable helper call is registered.
   *
   * @breaking v3: previously returned `this.messages.length > 0` with no
   * `input` parameter. For the old behavior, read `prompt.messages.length > 0`
   * directly.
   *
   * @throws LlmExeError with code `"prompt.missing_template_variable"` listing
   * all missing variables and helpers.
   */
  validate(input: I): void {
    const allMissingVariables: TemplateInputReference[] = [];
    const allMissingHelpers = new Set<string>();
    const registeredHelpers = this.helpers.reduce<Record<string, unknown>>(
      (acc, h) => {
        acc[h.name] = h.handler;
        return acc;
      },
      {}
    );
    const knownHelpers: Record<string, unknown> = {
      ...(hbs.handlebars as any).helpers,
      ...registeredHelpers,
    };

    for (const template of this.getTemplateContents()) {
      const result = validateTemplateInputReferences(template.content, input, {
        helpers: knownHelpers,
        location: template.location,
      });
      allMissingVariables.push(...result.missingVariables);
      for (const helper of result.missingHelpers) {
        allMissingHelpers.add(helper);
      }
    }

    if (allMissingVariables.length === 0 && allMissingHelpers.size === 0) {
      return;
    }

    const dedupedVariables = Array.from(
      new Set(allMissingVariables.map((r) => r.path))
    );

    throw missingTemplateReferencesError({
      operation: "Prompt.validate",
      promptType: this.type,
      missingVariables: dedupedVariables,
      missingHelpers: Array.from(allMissingHelpers),
    });
  }
}
