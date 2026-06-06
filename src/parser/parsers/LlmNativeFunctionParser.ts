import {
  OutputResult,
  OutputResultContent,
  ParserOutput,
} from "@/types";
import { BaseParser } from "../_base";

import { maybeParseJSON } from "@/utils";

export interface LlmNativeFunctionParserOptions<T extends BaseParser<any, any>> {
  parser: T;
}

export class LlmFunctionParser<T extends BaseParser<any, any>> extends BaseParser<
  ParserOutput<T> | OutputResultContent[],
  OutputResult | string
> {
  public parser: T;

  constructor(options: LlmNativeFunctionParserOptions<T>) {
    // pass the `function_call` target through so the executor knows
    super("functionCall", "function_call");
    this.parser = options.parser;
  }
  parse(text: OutputResult, _options?: Record<string, any>) {
    if (typeof text === "string") {
      return this.parser.parse(text, _options) as ParserOutput<T>;
    }
    const { content } = text;
    const functionUses =
      content?.filter((a) => a.type === "function_use") || [];

    if (functionUses.length === 0) {
      const [item] = content;
      return this.parser.parse(item.text!, _options) as ParserOutput<T>;
    }

    // we pass the output response through, its been formatted by output
    return content as OutputResultContent[];
  }
}

/**
 * @deprecated Use `LlmFunctionParser` instead.
 */
export class LlmNativeFunctionParser<
  T extends BaseParser<any, any>,
> extends BaseParser<ParserOutput<T> | { name: any; arguments: any }, OutputResult | string> {
  public parser: T;

  constructor(options: LlmNativeFunctionParserOptions<T>) {
    // pass the `function_call` target through so the executor knows
    super("openAiFunction", "function_call");
    this.parser = options.parser;
  }
  parse(text: OutputResult, _options?: Record<string, any>) {
    if (typeof text === "string") {
      return this.parser.parse(text, _options) as ParserOutput<T>;
    }

    if (typeof (text as any)?.text === "string") {
      return this.parser.parse((text as any).text, _options) as ParserOutput<T>;
    }

    const { content } = text;
    const functionUse = content?.find((a) => a.type === "function_use");
    if (functionUse && "name" in functionUse && "input" in functionUse) {
      return {
        name: functionUse.name,
        arguments: maybeParseJSON(functionUse.input),
      };
    }

    const textContent = content?.find(
      (item) => item.type === "text" && typeof item.text === "string"
    );
    return this.parser.parse(textContent?.text as any, _options) as ParserOutput<T>;
  }
}

/**
 * @deprecated Use `LlmExecutorWithFunctions` instead.
 */
export const OpenAiFunctionParser = LlmNativeFunctionParser;
