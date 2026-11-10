import type {
  CoreExecutorExecuteOptions,
  DecisionExecutorInput,
  DecisionQuestionMap,
  DecisionResult,
  ExecutionContext,
} from "@/types";
import type { DecisionModel } from "@/decision/decision";
import { assertValidDecisionQuestions } from "@/decision/questions";
import { LlmExeError } from "@/errors";
import { BaseExecutor } from "./_base";

export type DecisionExecutorOptions<Q extends DecisionQuestionMap> =
  CoreExecutorExecuteOptions<DecisionExecutorInput, DecisionResult<Q>> & {
    name?: string;
  };

function isDecisionInput(value: unknown): boolean {
  return (
    typeof value === "string" || (typeof value === "object" && value !== null)
  );
}

/**
 * Runs a fixed set of questions against a decision model. execute() takes
 * `{ input }` and resolves to one typed answer per question.
 */
export class DecisionExecutor<
  Q extends DecisionQuestionMap,
> extends BaseExecutor<DecisionExecutorInput, DecisionResult<Q>> {
  readonly model: DecisionModel;
  readonly questions: Q;

  constructor(
    model: DecisionModel,
    questions: Q,
    options?: DecisionExecutorOptions<Q>,
  ) {
    super(
      options?.name || "anonymous-decision-executor",
      "decision-executor",
      options,
    );
    assertValidDecisionQuestions(questions, {
      maxQuestions: model.maxQuestions,
      operation: "createDecisionExecutor",
    });
    this.model = model;
    this.questions = questions;
  }

  async handler(
    _input: DecisionExecutorInput,
    _options?: unknown,
    _context?: ExecutionContext<DecisionExecutorInput, DecisionResult<Q>>,
  ): Promise<DecisionResult<Q>> {
    if (!isDecisionInput(_input.input)) {
      throw new LlmExeError(
        `Decision executor "${this.name}" needs { input } to be a string or a JSON object or array.`,
        {
          code: "prompt.missing_input",
          context: { operation: "DecisionExecutor.handler" },
        },
      );
    }
    const result = await this.model.call(
      { input: _input.input, questions: this.questions },
      undefined,
      _context,
    );
    // The response was normalized against this.questions, so its answers are
    // keyed and typed by Q. TypeScript can't follow that through the request
    // wrapper's generic, so the link is restated here.
    return result as DecisionResult<Q>;
  }

  metadata() {
    return {
      model: this.model.getMetadata(),
      questions: Object.keys(this.questions),
    };
  }

  getTraceId() {
    if (this.traceId) {
      return this.traceId;
    }
    return this.model.getTraceId();
  }
}

/**
 * Creates an executor that asks a decision model a fixed set of questions.
 * Answer types follow the question map: a choice answer is typed to its
 * option keys and a score answer to its level labels.
 *
 * @example
 * const triage = createDecisionExecutor(useDecisionModel("openai.gpt-6-luna"), {
 *   urgent: { type: "boolean", instructions: "Is this urgent?" },
 * });
 * const { answers } = await triage.execute({ input: ticketText });
 */
export function createDecisionExecutor<const Q extends DecisionQuestionMap>(
  model: DecisionModel,
  questions: Q,
  options?: DecisionExecutorOptions<Q>,
) {
  return new DecisionExecutor<Q>(model, questions, options);
}
