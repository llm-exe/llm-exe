import { createLlmExecutor } from "@/executor/_functions";
import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";
import { createParser } from "@/parser";
import { defineSchema } from "@/utils/modules/defineSchema";
import type { IChatMessages, ExecutorMetadata } from "@/types";

/**
 * Type-level contract for executor hook callbacks. These assertions are
 * enforced at compile time by ts-jest — if a refactor breaks the inference
 * chain (prompt input → handlerInput, raw call → handlerOutput, parser →
 * output), this file stops compiling and the suite fails. The runtime
 * `expect` exists only to give Jest a body to run.
 *
 * Contract under test (see `ExecutorExecutionMetadata<I, O, R, HI>`):
 *  - arg.input         → prompt input type
 *  - arg.handlerInput  → formatted prompt (IChatMessages for chat prompts)
 *  - arg.handlerOutput → raw BaseLlCall (so usage is reachable + typed)
 *  - arg.output        → parser output type
 *  - second hook arg   → ExecutorMetadata
 */

const schema = defineSchema({
  type: "object",
  properties: { summary: { type: "string" } },
  required: ["summary"],
  additionalProperties: false,
});

describe("llm-exe:executor/hook type inference", () => {
  it("infers metadata types in the constructor hooks option", () => {
    createLlmExecutor(
      {
        llm: useLlm("openai.chat-mock.v1"),
        prompt: createChatPrompt<{ text: string }>("Summarize: {{text}}"),
        parser: createParser("json", { schema }),
      },
      {
        hooks: {
          onComplete: (arg, executor) => {
            // input is the prompt's generic input type
            const text: string = arg.input.text;
            // handlerInput is the formatted chat prompt
            const messages: IChatMessages | undefined = arg.handlerInput;
            // handlerOutput is the raw call — usage is typed off it
            const total: number | undefined = arg.handlerOutput
              ?.getResult()
              .usage.total_tokens;
            // output is the parser output (schema-derived)
            const summary: string | undefined = arg.output?.summary;
            // second arg is the executor identity metadata
            const meta: ExecutorMetadata = executor;

            void text;
            void messages;
            void total;
            void summary;
            void meta;
          },
        },
      }
    );

    expect(true).toBe(true);
  });

  it("infers metadata types via .on()", () => {
    const executor = createLlmExecutor({
      llm: useLlm("openai.chat-mock.v1"),
      prompt: createChatPrompt<{ text: string }>("Summarize: {{text}}"),
      parser: createParser("json", { schema }),
    });

    executor.on("onSuccess", (arg) => {
      const text: string = arg.input.text;
      const summary: string | undefined = arg.output?.summary;
      const total: number | undefined = arg.handlerOutput
        ?.getResult()
        .usage.total_tokens;
      void text;
      void summary;
      void total;
    });

    expect(executor.getHookCount("onSuccess")).toBe(1);
  });

  it("rejects mistyped hook usage at compile time", () => {
    if (false) {
      createLlmExecutor(
        {
          llm: useLlm("openai.chat-mock.v1"),
          prompt: createChatPrompt<{ text: string }>("Summarize: {{text}}"),
          parser: createParser("json", { schema }),
        },
        {
          hooks: {
            onComplete: (arg) => {
              // @ts-expect-error input.text is a string, not a number
              const wrongInput: number = arg.input.text;
              // @ts-expect-error handlerInput is IChatMessages, not a string
              const wrongHandlerInput: string = arg.handlerInput;
              // @ts-expect-error usage.total_tokens is a number, not a string
              const wrongUsage: string = arg.handlerOutput
                ?.getResult()
                .usage.total_tokens;
              // @ts-expect-error input has no `nope` property
              const wrongKey = arg.input.nope;

              void wrongInput;
              void wrongHandlerInput;
              void wrongUsage;
              void wrongKey;
            },
          },
        }
      );
    }

    expect(true).toBe(true);
  });
});
