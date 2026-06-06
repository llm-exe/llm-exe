import {
  BaseLlm,
  PromptInput,
  ParserOutput,
  CoreExecutorExecuteOptions,
  ExecutorWithLlmOptions,
  ExecutorExecutionMetadata,
  ExecutionContext,
  LlmExecutorHooks,
  LlmExecutorExecuteOptions,
  BaseLlCall,
  OutputResult,
} from "@/types";
import { BaseParser, JsonParser, StringParser } from "@/parser";
import { BasePrompt } from "@/prompt";
import { BaseState } from "@/state";
import { BaseExecutor } from "./_base";
import { isPromise } from "@/utils/modules/isPromise";
import { LlmExeError } from "@/errors";

/**
 * Core Executor With LLM
 */
export class LlmExecutor<
  Llm extends BaseLlm<any>,
  Prompt extends BasePrompt<Record<string, any>>,
  Parser extends BaseParser<any, any>,
  State extends BaseState,
> extends BaseExecutor<
  PromptInput<Prompt>,
  ParserOutput<Parser>,
  LlmExecutorHooks
> {
  public llm;
  public prompt;
  public promptFn: any;
  public parser;

  constructor(
    llmConfiguration: ExecutorWithLlmOptions<Llm, Prompt, Parser, State>,
    options?: CoreExecutorExecuteOptions<LlmExecutorHooks>
  ) {
    super(
      llmConfiguration.name || "anonymous-llm-executor",
      "llm-executor",
      options
    );

    this.llm = llmConfiguration.llm;
    this.parser = llmConfiguration?.parser || new StringParser();

    if (typeof llmConfiguration.prompt === "function") {
      this.prompt = undefined;
      this.promptFn = llmConfiguration.prompt;
    } else {
      this.prompt = llmConfiguration.prompt;
      this.promptFn = null;
    }
  }

  /**
   * Runs the executor against the configured LLM and prompt.
   *
   * `null` and `undefined` are rejected with a `TypeError`: the declared
   * input type requires an object, and silently coercing missing input hides a
   * clear contract violation. Use `{}` for prompts that declare no template
   * variables. See issue #410.
   */
  async execute(
    _input: PromptInput<Prompt>,
    _options?: LlmExecutorExecuteOptions
  ): Promise<ParserOutput<Parser>> {
    if (_input === null || typeof _input === "undefined") {
      throw new TypeError(
        `[llm-exe] Executor "${this.name}" received null or undefined as input. ` +
          `execute() expects an object matching the prompt's input type.`
      );
    }
    if (this?.parser instanceof JsonParser && this.parser.schema) {
      _options = Object.assign(_options || {}, {
        jsonSchema: this.parser.schema,
      });
    }
    return super.execute(_input, _options);
  }

  async handler(
    _input: PromptInput<Prompt>,
    _options?: LlmExecutorExecuteOptions,
    _context?: ExecutionContext<PromptInput<Prompt>, ParserOutput<Parser>>
  ) {
    const call = await this.llm.call(_input, _options, _context);
    return call;
  }

  async getHandlerInput(_input: PromptInput<Prompt>): Promise<any> {
    if (this.prompt) {
      if (isPromise(this.prompt.formatAsync)) {
        return await this.prompt.formatAsync(_input);
      } else {
        return this.prompt.format(_input);
      }
    }

    if (this.promptFn) {
      const prompt = this.promptFn(_input);
      if (isPromise(prompt.formatAsync)) {
        return await prompt.formatAsync(_input);
      } else {
        return prompt.format(_input);
      }
    }
    throw new LlmExeError("Missing prompt", {
      code: "executor.missing_prompt",
      context: {
        operation: "LlmExecutor.getHandlerInput",
        executorName: this.name,
        executorType: this.type,
        traceId: this.getTraceId() ?? undefined,
        resolution:
          "Provide a prompt (or prompt factory) when constructing the LLM executor.",
      },
    });
  }

  getHandlerOutput(
    out: BaseLlCall,
    _metadata: ExecutorExecutionMetadata<
      PromptInput<Prompt>,
      ParserOutput<Parser>
    >,
    _options?: LlmExecutorExecuteOptions,
    _context?: ExecutionContext<PromptInput<Prompt>, ParserOutput<Parser>>
  ): ParserOutput<Parser> {
    // depending on out parser type, and result obj (out)
    // we should use different methods here
    // The executor is the polymorphic dispatcher. Text parsers receive
    // getResultText(), while function-call parsers receive getResult().
    const parse = (
      this.parser as BaseParser<ParserOutput<Parser>, string | OutputResult>
    ).parse.bind(this.parser);
    // Pass the full ExecutionContext to the parser when available; otherwise
    // fall back to the execution metadata for back-compat.
    const parserArg = _context ?? _metadata;
    if (this.parser.target === "function_call") {
      const outToStr = out.getResult();
      return parse(outToStr, parserArg);
    } else {
      const outToStr = out.getResultText();
      return parse(outToStr, parserArg);
    }
  }

  metadata() {
    return {
      llm: this.llm.getMetadata(),
    };
  }
  getTraceId() {
    if (this.traceId) {
      return this.traceId;
    }
    return this.llm.getTraceId();
  }
}
