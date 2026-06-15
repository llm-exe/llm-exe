import { maybeStringifyJSON } from "@/utils";
import { assert } from "@/utils/modules/assert";
import { BasePrompt } from "./_base";
import {
  IChatMessages,
  IChatUserMessage,
  IChatMessageRole,
  ChatPromptType,
  ChatPromptOptions,
  IPromptChatMessages,
  IChatMessage,
  IChatMessageContentDetailed,
} from "@/types";
import { extractPromptPlaceholderToken } from "@/utils/modules/extractPromptPlaceholderToken";
import { pick } from "@/utils/modules/pick";
import { get } from "@/utils/modules/get";
import { escape } from "@/utils/modules/escape";

export interface ChatPrompt<I extends Record<string, any>>
  extends BasePrompt<I> {
  messages: IPromptChatMessages;
}

/**
 * `ChatPrompt` provides a conversation-style prompt enabling various roles.
 * The chat prompt can be used with models such as gpt-3.5.turbo and gpt-4+.
 * @extends BasePrompt
 */
export class ChatPrompt<I extends Record<string, any>> extends BasePrompt<I> {
  /**
   * @property type - Prompt type (chat)
   */
  readonly type: ChatPromptType = "chat";

  /**
   * @property parseUserTemplates - Whether or not to allow parsing
   * user messages with the template engine. Defaults to true.
   * Set `allowUnsafeUserTemplate: false` in options to disable.
   */
  private parseUserTemplates = true;

  /**
   * new `ChatPrompt`
   * @param initialSystemPromptMessage (optional) An initial system message to add to the new prompt.
   * @param options (optional) Options to pass in when creating the prompt.
   */
  constructor(
    initialSystemPromptMessage?: string,
    options?: ChatPromptOptions
  ) {
    super(initialSystemPromptMessage, options);
    if (typeof options?.allowUnsafeUserTemplate === "boolean") {
      this.parseUserTemplates = options?.allowUnsafeUserTemplate;
    }
  }

  /**
   * addToPrompt Adds a message to the prompt based on role.
   * @param content The message content.
   * @param role The role of the chat user. Must be one of: assistant, system, user.
   * @param name (optional) The name of the user. Only accepted if role is `user`.
   * @return instance of ChatPrompt.
   */
  addToPrompt(
    content: string,
    role: Extract<IChatMessageRole, "assistant" | "model">,
    name?: undefined
  ): ChatPrompt<I>;
  addToPrompt(
    content: string,
    role: Extract<IChatMessageRole, "system">,
    name?: undefined
  ): ChatPrompt<I>;
  addToPrompt(
    content: string,
    role: Extract<IChatMessageRole, "user">,
    name?: string
  ): ChatPrompt<I>;
  addToPrompt(
    content: string,
    role: Extract<IChatMessageRole, "function">,
    name: string
  ): ChatPrompt<I>;
  addToPrompt(
    content: string,
    role: Extract<IChatMessageRole, "function_call">,
    name: string
  ): ChatPrompt<I>;
  addToPrompt(
    content: string,
    role: IChatMessageRole,
    name?: string,
    id?: string
  ): ChatPrompt<I> {
    if (content) {
      switch (role) {
        case "system":
          this.addSystemMessage(content);
          break;
        case "user":
          this.addUserMessage(content, name);
          break;
        case "assistant":
          this.addAssistantMessage(content);
          break;
        case "function":
          assert(name, "Function message requires name");
          this.addFunctionMessage(content, name, id);
          break;
        case "function_call":
          assert(name, "Function message requires name");
          this.addFunctionCallMessage({ name: name, arguments: content, id });
          break;
      }
    }
    return this;
  }

  /**
   * addUserMessage Helper to add a user message to the prompt.
   * @param content The message content.
   * @param name (optional) The name of the user.
   * @return instance of ChatPrompt.
   */
  addUserMessage(
    content: string | IChatMessageContentDetailed[],
    name?: string
  ): ChatPrompt<I> {
    const message: IChatUserMessage = {
      role: "user",
      content,
    };
    if (name) {
      message.name = name;
    }
    this.messages.push(message);
    return this;
  }

  /**
   * addAssistantMessage Helper to add an assistant message to the prompt.
   * @param content The message content.
   * @return ChatPrompt so it can be chained.
   */
  addAssistantMessage(content: string): ChatPrompt<I> {
    this.messages.push({
      role: "assistant",
      content,
    });
    return this;
  }

  /**
   * addFunctionMessage Helper to add a function message to the prompt.
   * @param content The message content.
   * @return ChatPrompt so it can be chained.
   */
  addFunctionMessage(
    content: string,
    name: string,
    id?: string
  ): ChatPrompt<I> {
    this.messages.push({
      role: "function",
      name,
      content,
      id,
    });
    return this;
  }
  /**
   * addFunctionCallMessage Helper to add a function_call message to the prompt.
   * @param content The message content.
   * @return ChatPrompt so it can be chained.
   */

  addFunctionCallMessage(function_call?: {
    name: string;
    arguments: string;
    id?: string;
  }) {
    if (function_call) {
      this.messages.push({
        role: "function_call",
        function_call: {
          id: function_call.id,
          name: function_call.name,
          arguments: maybeStringifyJSON(function_call.arguments),
        },
        content: null,
      });
    }

    return this;
  }
  /**
   * addFromHistory Adds multiple messages at one time.
   * @param history History of chat messages.
   * @return ChatPrompt so it can be chained.
   */
  addFromHistory(history: IChatMessages): ChatPrompt<I> {
    if (history && Array.isArray(history)) {
      for (const message of history) {
        switch (message.role) {
          case "user":
            this.addUserMessage(message.content, message?.name);
            break;
          case "assistant":
            this.addAssistantMessage(message?.content);
            break;
          case "system":
            this.addSystemMessage(message.content);
            break;
          case "function_call":
            this.addFunctionCallMessage(message.function_call);
            break;
          case "function":
            this.addFunctionMessage(message.content, message.name, message.id);
            break;
        }
      }
    }
    return this;
  }

  /**
   * addPlaceholder description
   * @param content The message content
   * @return returns ChatPrompt so it can be chained.
   */
  addChatHistoryPlaceholder(
    key: keyof I,
    options?: { assistant?: string; user?: string }
  ): ChatPrompt<I> {
    const start = `{{> DialogueHistory `;
    const params = [`key='${String(key)}'`];
    const end = `}}`;

    if (options?.assistant) {
      params.push(`assistant='${options.assistant}'`);
    }
    if (options?.user) {
      params.push(`user='${options.user}'`);
    }
    this.messages.push({
      role: "placeholder",
      content: `${start}${params.join(" ")}${end}`,
    });
    return this;
  }

  /**
   * addTokenPlaceholder description
   * @param content The message content
   * @return returns ChatPrompt so it can be chained.
   */
  addMessagePlaceholder(
    content: string,
    role: IChatMessageRole = "user",
    name?: string
  ) {
    if (content) {
      const start = `{{> SingleChatMessage `;
      const params = [`role='${role}'`, `content='${escape(content)}'`];
      const end = `}}`;
      if (name) {
        params.push(`name='${name}'`);
      }
      this.messages.push({
        role: "placeholder",
        content: `${start}${params.join(" ")}${end}`,
      });
    }
    return this;
  }

  private _format_placeholderDialogueHistory(
    data: ReturnType<typeof extractPromptPlaceholderToken>,
    replacements: any
  ) {
    const messagesOut: IChatMessages = [];

    /* istanbul ignore next */
    const { key = "", user } = data;
    const history: IChatMessages = get(replacements, key, []);
    if (history && Array.isArray(history)) {
      for (const message of history) {
        switch (message.role) {
          case "user": {
            const m = pick(message, ["role", "content", "name"]);
            if (user) {
              m["name"] = user;
            }
            messagesOut.push(m);
            break;
          }

          case "assistant": {
            messagesOut.push({
              role: "assistant",
              content: message.content,
            });
            break;
          }
          case "function_call":
            messagesOut.push({
              role: "function_call",
              content: null,
              function_call: message.function_call,
            });
            break;
          case "function":
            messagesOut.push({
              role: "function",
              name: message.name,
              content: message.content,
            });
            break;
          case "system":
            messagesOut.push({
              role: "system",
              content: message.content,
            });
            break;
        }
      }
    }

    return messagesOut;
  }

  /**
   * format formats the stored prompt based on input values.
   * Uses template engine.
   * Output is intended for LLM.
   * @param values input values.
   * @return formatted prompt.
   */
  format(values: I): IChatMessages {
    this.preflightValidate(values);
    const messagesOut: IChatMessages = [];
    const replacements = this.getReplacements(values);
    const safeToParseTemplate = ["assistant", "system"];

    if (this.parseUserTemplates) {
      safeToParseTemplate.push("user");
    }

    for (const message of this.messages) {
      if (message.role === "placeholder") {
        const tokenData = extractPromptPlaceholderToken(message.content);
        switch (tokenData.token) {
          case ">DialogueHistory": {
            messagesOut.push(
              ...this._format_placeholderDialogueHistory(
                tokenData,
                replacements
              )
            );
            break;
          }
          case ">SingleChatMessage": {
            const { name, content, role } = tokenData;
            if (role && content) {
              const message = {
                role,
                name,
                content: this.replaceTemplateString(content, replacements, {
                  partials: this.partials,
                  helpers: this.helpers,
                }),
              };

              if (!name || role !== "user") {
                delete message.name;
              }
              messagesOut.push(message as IChatMessage);
            }
            break;
          }
        }
      } else if (message.role === "function") {
        messagesOut.push(
          Object.assign({}, message, {
            content: this.replaceTemplateString(message.content, replacements, {
              partials: this.partials,
              helpers: this.helpers,
            }),
          })
        );
      } else {
        if (safeToParseTemplate.includes(message.role)) {
          if (Array.isArray(message.content)) {
            const content = message.content.map((m) =>
              m.text
                ? {
                    type: "text",
                    text: this.runPromptFilter(
                      this.replaceTemplateString(
                        this.runPromptFilter(m.text, this.filters.pre, values),
                        replacements,
                        {
                          partials: this.partials,
                          helpers: this.helpers,
                        }
                      ),
                      this.filters.post,
                      values
                    ),
                  }
                : m
            );
            messagesOut.push(Object.assign({}, message, { content }));
          } else if (message.content) {
            const content = this.runPromptFilter(
              this.replaceTemplateString(
                this.runPromptFilter(message.content, this.filters.pre, values),
                replacements,
                {
                  partials: this.partials,
                  helpers: this.helpers,
                }
              ),
              this.filters.post,
              values
            );
            messagesOut.push(Object.assign({}, message, { content }));
          } else {
            messagesOut.push(Object.assign({}, message, { content: null }));
          }
        } else {
          /* istanbul ignore next */
          messagesOut.push(
            Object.assign({}, message, {
              content: Array.isArray(message.content)
                ? message.content.map((m) =>
                    m.text
                      ? {
                          type: "text",
                          text: this.runPromptFilter(
                            this.runPromptFilter(
                              m.text,
                              this.filters.pre,
                              values
                            ),
                            this.filters.post,
                            values
                          ),
                        }
                      : m
                  )
                : message.content && !Array.isArray(message.content)
                  ? this.runPromptFilter(
                      this.runPromptFilter(
                        message.content,
                        this.filters.pre,
                        values
                      ),
                      this.filters.post,
                      values
                    )
                  : null,
            })
          );
        }
      }
    }
    return messagesOut;
  }

  /**
   * format formats the stored prompt based on input values.
   * Uses template engine.
   * Output is intended for LLM.
   * @param values input values.
   * @return formatted prompt.
   */
  async formatAsync(values: I): Promise<IChatMessages> {
    this.preflightValidate(values);
    const messagesOut: IChatMessages = [];
    const replacements = this.getReplacements(values);
    const safeToParseTemplate = ["assistant", "system"];

    if (this.parseUserTemplates) {
      safeToParseTemplate.push("user");
    }

    for (const message of this.messages) {
      if (message.role === "placeholder") {
        const { token, ...data } = extractPromptPlaceholderToken(
          message.content
        );
        switch (token) {
          case ">DialogueHistory": {
            /* istanbul ignore next */
            const { key = "", user } = data;
            const history: IChatMessages = get(replacements, key, []);
            if (history && Array.isArray(history)) {
              for (const message of history) {
                switch (message.role) {
                  case "user": {
                    const m = pick(message, ["role", "content", "name"]);
                    if (user) {
                      m["name"] = user;
                    }
                    messagesOut.push(m);
                    break;
                  }

                  case "assistant": {
                    messagesOut.push({
                      role: "assistant",
                      content: message.content,
                    });
                    break;
                  }
                  case "function_call":
                    messagesOut.push({
                      role: "function_call",
                      content: null,
                      function_call: message.function_call,
                    });
                    break;
                  case "function":
                    messagesOut.push({
                      role: "function",
                      name: message.name,
                      content: message.content,
                    });
                    break;
                  case "system":
                    messagesOut.push({
                      role: "system",
                      content: message.content,
                    });
                    break;
                }
              }
            }
            break;
          }
          case ">SingleChatMessage": {
            const { name, content, role } = data;
            if (role && content) {
              const message = {
                role,
                name,
                content: await this.replaceTemplateStringAsync(
                  content,
                  replacements,
                  {
                    partials: this.partials,
                    helpers: this.helpers,
                  }
                ),
              };

              if (!name || role !== "user") {
                delete message.name;
              }
              messagesOut.push(message as IChatMessage);
            }
            break;
          }
        }
      } else if (message.role === "function") {
        messagesOut.push(
          Object.assign({}, message, {
            content: await this.replaceTemplateStringAsync(
              message.content,
              replacements,
              {
                partials: this.partials,
                helpers: this.helpers,
              }
            ),
          })
        );
      } else {
        if (safeToParseTemplate.includes(message.role)) {
          if (Array.isArray(message.content)) {
            const content = [];

            for (const m of message.content) {
              if (m.text) {
                content.push({
                  type: "text",
                  text: this.runPromptFilter(
                    // HERE
                    await this.replaceTemplateStringAsync(
                      this.runPromptFilter(m.text, this.filters.pre, values),
                      replacements,
                      {
                        partials: this.partials,
                        helpers: this.helpers,
                      }
                    ),
                    this.filters.post,
                    values
                  ),
                });
              } else {
                content.push(m);
              }
            }

            messagesOut.push(Object.assign({}, message, { content }));
          } else if (message.content) {
            const content = this.runPromptFilter(
              await this.replaceTemplateStringAsync(
                this.runPromptFilter(message.content, this.filters.pre, values),
                replacements,
                {
                  partials: this.partials,
                  helpers: this.helpers,
                }
              ),
              this.filters.post,
              values
            );
            messagesOut.push(Object.assign({}, message, { content }));
          } else {
            messagesOut.push(Object.assign({}, message, { content: null }));
          }
        } else {
          /* istanbul ignore next */
          messagesOut.push(
            Object.assign({}, message, {
              content: Array.isArray(message.content)
                ? message.content.map((m) =>
                    m.text
                      ? {
                          type: "text",
                          text: this.runPromptFilter(
                            this.runPromptFilter(
                              m.text,
                              this.filters.pre,
                              values
                            ),
                            this.filters.post,
                            values
                          ),
                        }
                      : m
                  )
                : message.content && !Array.isArray(message.content)
                  ? this.runPromptFilter(
                      this.runPromptFilter(
                        message.content,
                        this.filters.pre,
                        values
                      ),
                      this.filters.post,
                      values
                    )
                  : null,
            })
          );
        }
      }
    }
    return messagesOut;
  }
}
