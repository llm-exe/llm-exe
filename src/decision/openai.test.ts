import type { DecisionQuestionMap } from "@/types";
import { fromOpenAiDecisionResponse, toOpenAiDecisionBody } from "./openai";

const questions = {
  urgent: { type: "boolean", instructions: "Is this request urgent?" },
  team: {
    type: "choice",
    instructions: "Which team should handle this first?",
    options: {
      billing: "Payments and refunds",
      technical: "Outages and errors",
    },
  },
  severity: {
    type: "score",
    instructions: "How severe is the customer impact?",
    levels: [
      "None",
      "Minor",
      "Major",
      { label: "Critical", description: "Money lost or service down" },
    ],
  },
} as const satisfies DecisionQuestionMap;

// Recorded from a real POST /v1/decisions call with the questions above.
const recordedResponse = {
  model: "gpt-6-luna",
  answers: [
    { type: "predicate", name: "urgent", probability: 0.95 },
    {
      type: "choice",
      name: "team",
      choice: "billing",
      probabilities: [
        { value: "billing", probability: 0.99 },
        { value: "technical", probability: 0.01 },
      ],
      confidence: 0.98,
    },
    {
      type: "score",
      name: "severity",
      score: 2.99,
      probabilities: [
        { value: 0, label: "None", probability: 0.0 },
        { value: 1, label: "Minor", probability: 0.0 },
        { value: 2, label: "Major", probability: 0.01 },
        { value: 3, label: "Critical", probability: 0.99 },
      ],
      confidence: 0.99,
    },
  ],
  usage: {
    input_tokens: 420,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    output_tokens: 0,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: 420,
  },
};

const context = { provider: "openai.decisions", model: "gpt-6-luna" };

function withAnswer(name: string, answer: Record<string, unknown>) {
  return {
    ...recordedResponse,
    answers: recordedResponse.answers.map((a) =>
      a.name === name ? { name, ...answer } : a,
    ),
  };
}

function expectInvalidShape(raw: unknown) {
  expect(() => fromOpenAiDecisionResponse(raw, questions, context)).toThrow(
    expect.objectContaining({
      code: "llm.invalid_response_shape",
      context: expect.objectContaining({
        provider: "openai.decisions",
        model: "gpt-6-luna",
      }),
    }),
  );
}

describe("toOpenAiDecisionBody", () => {
  it("maps each question type to OpenAI's shape, in order", () => {
    expect(
      toOpenAiDecisionBody("gpt-6-luna", { input: "ticket", questions }),
    ).toEqual({
      model: "gpt-6-luna",
      input: "ticket",
      questions: [
        {
          name: "urgent",
          type: "predicate",
          instructions: "Is this request urgent?",
        },
        {
          name: "team",
          type: "choice",
          instructions: "Which team should handle this first?",
          choices: [
            { value: "billing", description: "Payments and refunds" },
            { value: "technical", description: "Outages and errors" },
          ],
        },
        {
          name: "severity",
          type: "score",
          instructions: "How severe is the customer impact?",
          levels: [
            { label: "None" },
            { label: "Minor" },
            { label: "Major" },
            { label: "Critical", description: "Money lost or service down" },
          ],
        },
      ],
    });
  });

  it.each([
    ["an object", { subject: "Refund", tags: ["billing"] }],
    ["an array", [{ id: 1 }, { id: 2 }]],
  ])("sends %s as an input_json part in a user message", (_label, input) => {
    const body = toOpenAiDecisionBody("gpt-6-luna", { input, questions });
    expect(body.input).toEqual([
      { role: "user", content: [{ type: "input_json", data: input }] },
    ]);
  });
});

describe("fromOpenAiDecisionResponse", () => {
  it("normalizes the recorded response into answers keyed by question name", () => {
    expect(
      fromOpenAiDecisionResponse(recordedResponse, questions, context),
    ).toEqual({
      model: "gpt-6-luna",
      answers: {
        urgent: { type: "boolean", probability: 0.95 },
        team: {
          type: "choice",
          choice: "billing",
          confidence: 0.98,
          probabilities: { billing: 0.99, technical: 0.01 },
        },
        severity: {
          type: "score",
          score: 2.99,
          level: "Critical",
          confidence: 0.99,
          probabilities: { None: 0, Minor: 0, Major: 0.01, Critical: 0.99 },
        },
      },
      usage: { inputTokens: 420, outputTokens: 0 },
    });
  });

  it("keeps the other answers when one question is refused", () => {
    const result = fromOpenAiDecisionResponse(
      withAnswer("team", { type: "refusal" }),
      questions,
      context,
    );
    expect(result.answers.team).toEqual({ type: "refusal" });
    expect(result.answers.urgent).toEqual({
      type: "boolean",
      probability: 0.95,
    });
  });

  it("matches score probabilities by level index, not by the echoed label", () => {
    const result = fromOpenAiDecisionResponse(
      withAnswer("severity", {
        type: "score",
        score: 1.2,
        confidence: 0.5,
        probabilities: [
          { value: 0, label: "none", probability: 0.1 },
          { value: 1, label: "MINOR", probability: 0.6 },
          { value: 2, label: "major", probability: 0.3 },
        ],
      }),
      questions,
      context,
    );
    expect(result.answers.severity).toEqual({
      type: "score",
      score: 1.2,
      level: "Minor",
      confidence: 0.5,
      probabilities: { None: 0.1, Minor: 0.6, Major: 0.3, Critical: 0 },
    });
  });

  it("picks the first level on a probability tie", () => {
    const result = fromOpenAiDecisionResponse(
      withAnswer("severity", {
        type: "score",
        score: 1.5,
        confidence: 0.1,
        probabilities: [
          { value: 1, probability: 0.5 },
          { value: 2, probability: 0.5 },
        ],
      }),
      questions,
      context,
    );
    expect(result.answers.severity).toMatchObject({ level: "Minor" });
  });

  it("fills options the provider left out with 0", () => {
    const result = fromOpenAiDecisionResponse(
      withAnswer("team", {
        type: "choice",
        choice: "billing",
        confidence: 0.9,
        probabilities: [{ value: "billing", probability: 0.97 }],
      }),
      questions,
      context,
    );
    expect(result.answers.team).toMatchObject({
      probabilities: { billing: 0.97, technical: 0 },
    });
  });

  it("leaves outputTokens out when the provider doesn't report it", () => {
    const result = fromOpenAiDecisionResponse(
      { ...recordedResponse, usage: { input_tokens: 12 } },
      questions,
      context,
    );
    expect(result.usage).toEqual({ inputTokens: 12 });
  });

  it("stores a question named __proto__ as an answer, not as the prototype", () => {
    const proto = JSON.parse(
      '{"__proto__": {"type": "boolean", "instructions": "x"}}',
    ) as DecisionQuestionMap;
    const result = fromOpenAiDecisionResponse(
      {
        model: "m",
        answers: [{ type: "predicate", name: "__proto__", probability: 0.4 }],
      },
      proto,
      context,
    );
    expect(Object.keys(result.answers)).toEqual(["__proto__"]);
    expect(Object.getPrototypeOf(result.answers)).toBe(Object.prototype);
  });

  it.each([
    ["not an object", "oops"],
    ["missing answers", { model: "m" }],
    [
      "missing one answer",
      { ...recordedResponse, answers: recordedResponse.answers.slice(0, 2) },
    ],
    [
      "a predicate answer for a choice question",
      withAnswer("team", { type: "predicate", probability: 0.5 }),
    ],
    [
      "a choice outside the options",
      withAnswer("team", {
        type: "choice",
        choice: "sales",
        confidence: 0.5,
        probabilities: [],
      }),
    ],
    [
      "a probability for an unknown option",
      withAnswer("team", {
        type: "choice",
        choice: "billing",
        confidence: 0.5,
        probabilities: [{ value: "sales", probability: 0.5 }],
      }),
    ],
    [
      "a non-numeric probability",
      withAnswer("urgent", { type: "predicate", probability: "high" }),
    ],
    [
      "a score level index out of range",
      withAnswer("severity", {
        type: "score",
        score: 1,
        confidence: 1,
        probabilities: [{ value: 9, probability: 1 }],
      }),
    ],
    [
      "a score without probabilities",
      withAnswer("severity", { type: "score", score: 1, confidence: 1 }),
    ],
    [
      "a probability for a prototype key",
      withAnswer("team", {
        type: "choice",
        choice: "billing",
        confidence: 0.5,
        probabilities: [{ value: "constructor", probability: 0.5 }],
      }),
    ],
  ])("throws llm.invalid_response_shape for %s", (_label, raw) => {
    expectInvalidShape(raw);
  });
});
