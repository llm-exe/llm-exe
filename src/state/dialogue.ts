import {
  IChatMessageContentDetailed,
  IChatMessages,
  IChatUserMessage,
  OutputResultsText,
  OutputResult,
  BaseLlCall,
} from "@/types";
import { BaseStateItem } from "./item";
import { maybeStringifyJSON } from "@/utils";
import { LlmExeError } from "@/errors";
import { isOutputResultContentText } from "@/utils/guards";

export class Dialogue extends BaseStateItem<IChatMessages> {
  public name: string;

  constructor(name: string) {
    super(name, []);
    this.name = name;
  }

  setUserMessage(
    content: string | IChatMessageContentDetailed[],
    name?: string
  ) {
    if (content) {
      const msg: IChatUserMessage = {
        role: "user",
        content,
      };
      if (name) {
        msg.name = name;
      }
      this.value.push(msg);
    }
    return this;
  }

  setAssistantMessage(content: string | OutputResultsText) {
    if (content) {
      if (isOutputResultContentText(content)) {
        this.value.push({
          role: "assistant",
          content: content.text,
        });
      } else {
        this.value.push({
          role: "assistant",
          content,
        });
      }
    }
    return this;
  }

  setSystemMessage(content: string) {
    if (content) {
      this.value.push({
        role: "system",
        content,
      });
    }
    return this;
  }

  setToolMessage(content: string, name: string, id?: string) {
    return this.setFunctionMessage(content, name, id);
  }

  setFunctionMessage(content: string, name: string, id?: string) {
    if (content) {
      this.value.push({
        role: "function",
        id,
        name,
        content,
      });
    }
    return this;
  }

  /**
   * Set
   */
  setToolCallMessage(input: { name: string; arguments: string; id?: string }) {
    return this.setFunctionCallMessage(input);
  }

  setFunctionCallMessage(
    input:
      | { name: string; arguments: string; id?: string }
      | {
          function_call: { name: string; arguments: string; id?: string };
        }
  ) {
    if (!input || typeof input !== "object") {
      throw new LlmExeError(`Invalid arguments`, {
        code: "state.invalid_arguments",
        context: {
          operation: "Dialogue.setFunctionCallMessage",
          module: "dialogue",
          expected: "object",
          received: typeof input,
        },
      });
    }

    // This is for backwards compatibility
    if ("function_call" in input) {
      if (!input.function_call || typeof input.function_call !== "object") {
        throw new LlmExeError(`Invalid arguments`, {
          code: "state.invalid_arguments",
          context: {
            operation: "Dialogue.setFunctionCallMessage",
            module: "dialogue",
            expected: "object",
            received: typeof input.function_call,
          },
        });
      }
      this.value.push({
        role: "function_call",
        function_call: {
          id: input?.function_call.id,
          name: input?.function_call.name,
          arguments: maybeStringifyJSON(input?.function_call.arguments),
        },
        content: null,
      });
      return this;
    }

    this.value.push({
      role: "function_call",
      function_call: {
        id: input?.id,
        name: input?.name,
        arguments: maybeStringifyJSON(input?.arguments),
      },
      content: null,
    });
    return this;
  }

  setMessageTurn(
    userMessage: string,
    assistantMessage: string,
    systemMessage: string = ""
  ) {
    this.setSystemMessage(systemMessage);
    this.setUserMessage(userMessage);
    this.setAssistantMessage(assistantMessage);
    return this;
  }

  /**
   * Aliases using `add*` naming to match ChatPrompt's API.
   * These delegate to the corresponding `set*` methods.
   */
  addUserMessage(
    content: string | IChatMessageContentDetailed[],
    name?: string
  ) {
    return this.setUserMessage(content, name);
  }

  addAssistantMessage(content: string | OutputResultsText) {
    return this.setAssistantMessage(content);
  }

  addSystemMessage(content: string) {
    return this.setSystemMessage(content);
  }

  addToolMessage(content: string, name: string, id?: string) {
    return this.setToolMessage(content, name, id);
  }

  addToolCallMessage(input: { name: string; arguments: string; id?: string }) {
    return this.setToolCallMessage(input);
  }

  addFunctionMessage(content: string, name: string, id?: string) {
    return this.setFunctionMessage(content, name, id);
  }

  addFunctionCallMessage(
    input:
      | { name: string; arguments: string; id?: string }
      | {
          function_call: { name: string; arguments: string; id?: string };
        }
  ) {
    return this.setFunctionCallMessage(input);
  }

  addMessageTurn(
    userMessage: string,
    assistantMessage: string,
    systemMessage: string = ""
  ) {
    return this.setMessageTurn(userMessage, assistantMessage, systemMessage);
  }

  addHistory(messages: IChatMessages) {
    return this.setHistory(messages);
  }

  setHistory(messages: IChatMessages) {
    for (const message of messages) {
      switch (message?.role) {
        case "user":
          this.setUserMessage(message?.content, message?.name);
          break;
        case "model":
        case "assistant":
          this.setAssistantMessage(message?.content);
          break;
        case "system":
          this.setSystemMessage(message?.content);
          break;
        case "function_call":
          this.setFunctionCallMessage({
            function_call: message.function_call,
          });
          break;
        case "function":
          this.setFunctionMessage(message?.content, message.name);
          break;
        default:
          this.value.push({
            role: (message as any).role,
            content: (message as any).content || "",
          });
      }
    }
    return this;
  }

  getHistory() {
    return this.getValue();
  }

  serialize() {
    return {
      class: "Dialogue",
      name: this.name,
      value: [...this.value],
    };
  }
  // deserialize() {}

  /**
   * Add LLM output to dialogue history in the order it was returned
   *
   * @param output - The LLM output result from llm.call()
   * @returns this for chaining
   */
  addFromOutput(output: OutputResult | BaseLlCall) {
    // Handle null/undefined/non-object inputs
    if (!output || typeof output !== "object") {
      return this;
    }
    
    // Handle both raw OutputResult and the wrapped BaseLlCall
    const result = "getResult" in output ? output.getResult() : output;

    if (!result || typeof result !== "object") {
      return this;
    }

    // Just add everything in order, exactly as returned
    for (const item of result.content) {
      if (item.type === "text") {
        this.setAssistantMessage(item.text);
      } else if (item.type === "function_use") {
        this.setToolCallMessage({
          name: item.name,
          arguments: maybeStringifyJSON(item.input),
          id: item.functionId,
        });
      }
    }

    return this;
  }
}
