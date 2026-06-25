import {
  BaseLlm,
  BaseLlCall,
  PromptInput,
  ParserOutput,
  CoreExecutorExecuteOptions,
  ExecutorWithLlmOptions,
  LlmExecutorHooks,
  LlmExecutorWithFunctionsOptions,
  GenericFunctionCall,
} from "@/types";
import { BasePrompt } from "@/prompt";
import { BaseState } from "@/state";
import { BaseParser, StringParser } from "@/parser";
import { LlmExecutor } from "./llm";
import {
  LlmFunctionParser,
  LlmNativeFunctionParser,
} from "@/parser/parsers/LlmNativeFunctionParser";

/**
 * Core Executor With LLM
 */
export class LlmExecutorWithFunctions<
  Llm extends BaseLlm,
  Prompt extends BasePrompt<Record<string, any>>,
  Parser extends BaseParser,
  State extends BaseState = BaseState,
> extends LlmExecutor<Llm, Prompt, LlmFunctionParser<Parser>, State> {
  constructor(
    llmConfiguration: ExecutorWithLlmOptions<Llm, Prompt, Parser, State>,
    options?: CoreExecutorExecuteOptions<
      PromptInput<Prompt>,
      ParserOutput<LlmFunctionParser<Parser>>,
      LlmExecutorHooks,
      BaseLlCall,
      ReturnType<Prompt["format"]>
    >
  ) {
    super(
      Object.assign({}, llmConfiguration, {
        parser: new LlmFunctionParser({
          parser: llmConfiguration.parser || (new StringParser() as Parser),
        }) as any,
      }),
      options
    );
  }

  async execute<T extends GenericFunctionCall>(
    _input: PromptInput<Prompt>,
    _options: LlmExecutorWithFunctionsOptions<T>
  ) {
    return super.execute(_input, _options);
  }
}

/**
 * @deprecated Use `LlmExecutorWithFunctions` instead.
 */
export class LlmExecutorOpenAiFunctions<
  Llm extends BaseLlm,
  Prompt extends BasePrompt<Record<string, any>>,
  Parser extends BaseParser,
  State extends BaseState = BaseState,
> extends LlmExecutor<Llm, Prompt, LlmNativeFunctionParser<Parser>, State> {
  constructor(
    llmConfiguration: ExecutorWithLlmOptions<Llm, Prompt, Parser, State>,
    options?: CoreExecutorExecuteOptions<
      PromptInput<Prompt>,
      ParserOutput<LlmNativeFunctionParser<Parser>>,
      LlmExecutorHooks,
      BaseLlCall,
      ReturnType<Prompt["format"]>
    >
  ) {
    super(
      Object.assign({}, llmConfiguration, {
        parser: new LlmNativeFunctionParser({
          parser: llmConfiguration.parser || (new StringParser() as Parser),
        }) as any,
      }),
      options
    );

    console.warn(
      `LlmExecutorOpenAiFunctions is deprecated. Please migrate to LlmExecutorWithFunctions`
    );
  }

  async execute<T extends GenericFunctionCall>(
    _input: PromptInput<Prompt>,
    _options: LlmExecutorWithFunctionsOptions<T>
  ) {
    return super.execute(_input, _options);
  }
}
