import { useDecisionModel } from "@/decision/decision";
import { createDecisionExecutor } from "./decision";
import type { DecisionQuestionMap, DecisionResult } from "@/types";

/**
 * Compile-time checks: answer types must follow the question map. These fail
 * at `tsc` time, not at runtime, so they guard against a generic quietly
 * widening to `string` or `any`.
 */

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

function assertType<_T extends true>(): void {}

const model = useDecisionModel("openai.gpt-6-luna", { openAiApiKey: "sk-x" });

const triage = createDecisionExecutor(model, {
  urgent: { type: "boolean", instructions: "Is it urgent?" },
  team: {
    type: "choice",
    instructions: "Which team?",
    options: { billing: "Payments", technical: "Outages" },
  },
  severity: {
    type: "score",
    instructions: "How severe?",
    levels: ["None", "Minor", { label: "Critical", description: "Down" }],
  },
});

type Result = Awaited<ReturnType<typeof triage.execute>>;
type Team = Exclude<Result["answers"]["team"], { type: "refusal" }>;
type Severity = Exclude<Result["answers"]["severity"], { type: "refusal" }>;
type Urgent = Exclude<Result["answers"]["urgent"], { type: "refusal" }>;

describe("decision executor type inference", () => {
  it("types choice answers to the option keys", () => {
    assertType<Equal<Team["choice"], "billing" | "technical">>();
    assertType<
      Equal<Team["probabilities"], Record<"billing" | "technical", number>>
    >();
  });

  it("types score answers to the level labels, including object levels", () => {
    assertType<Equal<Severity["level"], "None" | "Minor" | "Critical">>();
    assertType<Equal<Severity["score"], number>>();
  });

  it("types boolean answers as a probability", () => {
    assertType<Equal<Urgent, { type: "boolean"; probability: number }>>();
  });

  it("only knows the questions that were defined", () => {
    assertType<
      Equal<keyof Result["answers"], "urgent" | "team" | "severity">
    >();
    // @ts-expect-error not a question in the map
    type _Missing = Result["answers"]["priority"];
  });

  it("makes callers handle refusals before reading an answer", async () => {
    const check = (result: Result) => {
      const team = result.answers.team;
      // @ts-expect-error a refusal has no choice, so narrow first
      void team.choice;
      if (team.type === "refusal") return undefined;
      const choice: "billing" | "technical" = team.choice;
      return choice;
    };
    expect(check).toBeInstanceOf(Function);
  });

  it("falls back to wide types for a question map that isn't a literal", () => {
    type Wide = DecisionResult<DecisionQuestionMap>["answers"][string];
    type WideChoice = Extract<Wide, { type: "choice" }>;
    assertType<Equal<WideChoice["choice"], string>>();
  });
});
