import type { DecisionQuestionMap } from "@/types";
import { fromSystemOneResponse, toSystemOneBody } from "./systemone";

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

// Recorded from a real POST https://api.typesafe.ai/v1/systemone call (Jev).
const recordedJevResponse = {
  model: "jev-1.14.0",
  answers: {
    urgent: { type: "noul", noul: 0.92 },
    team: {
      type: "choice",
      choice: "billing",
      confidence: 0.12,
      probabilities: { billing: 0.56, technical: 0.44 },
    },
    severity: {
      type: "score",
      score: 2.98,
      confidence: 0.98,
      legend: {
        "0": "None",
        "1": "Minor",
        "2": "Major",
        "3": "Critical: Money lost or service down",
      },
      probabilities: { "0": 0.0, "1": 0.0, "2": 0.02, "3": 0.98 },
    },
  },
  usage: { input_tokens: 399, output_tokens: 61 },
};

const provider = { provider: "typesafe.systemone", model: "jev-latest" };

const expectedResult = {
  model: "jev-1.14.0",
  answers: {
    urgent: { type: "boolean", probability: 0.92 },
    team: {
      type: "choice",
      choice: "billing",
      confidence: 0.12,
      probabilities: { billing: 0.56, technical: 0.44 },
    },
    severity: {
      type: "score",
      score: 2.98,
      level: "Critical",
      confidence: 0.98,
      probabilities: { None: 0, Minor: 0, Major: 0.02, Critical: 0.98 },
    },
  },
  usage: { inputTokens: 399, outputTokens: 61 },
};

function withAnswer(name: string, answer: Record<string, unknown>) {
  return {
    ...recordedJevResponse,
    answers: { ...recordedJevResponse.answers, [name]: answer },
  };
}

describe("toSystemOneBody", () => {
  it("maps questions to System One's keyed shape", () => {
    expect(
      toSystemOneBody("jev-latest", { input: "ticket", questions }),
    ).toEqual({
      model: "jev-latest",
      state: "ticket",
      questions: {
        urgent: { type: "noul", instructions: "Is this request urgent?" },
        team: {
          type: "choice",
          instructions: "Which team should handle this first?",
          criteria: {
            billing: "Payments and refunds",
            technical: "Outages and errors",
          },
        },
        severity: {
          type: "score",
          instructions: "How severe is the customer impact?",
          // A level's description is kept by appending it to the label.
          criteria: [
            "None",
            "Minor",
            "Major",
            "Critical: Money lost or service down",
          ],
        },
      },
    });
  });

  it("sends JSON input as state unchanged", () => {
    const input = { subject: "Refund", tags: ["billing"] };
    expect(toSystemOneBody("jev-latest", { input, questions }).state).toBe(
      input,
    );
  });
});

describe("fromSystemOneResponse", () => {
  it("normalizes the recorded Jev response", () => {
    expect(
      fromSystemOneResponse(recordedJevResponse, questions, provider),
    ).toEqual(expectedResult);
  });

  it("unwraps a Cloudflare { result, success, errors } envelope", () => {
    const wrapped = {
      result: recordedJevResponse,
      success: true,
      errors: [],
      messages: [],
    };
    expect(fromSystemOneResponse(wrapped, questions, provider)).toEqual(
      expectedResult,
    );
  });

  it("normalizes a recorded Cloudflare Clef response (wrapped in its envelope)", () => {
    // Recorded from a real POST .../ai/run/@cf/cloudflare/clef call.
    const recordedClefResponse = {
      result: {
        model: "clef",
        answers: {
          urgent: { type: "noul", noul: 0.8469 },
          team: {
            type: "choice",
            choice: "billing",
            confidence: 0.4094,
            probabilities: { billing: 0.8199, technical: 0.1801 },
          },
          severity: {
            type: "score",
            score: 2.7709,
            confidence: 0.5522,
            probabilities: {
              "0": 0.0049,
              "1": 0.0112,
              "2": 0.192,
              "3": 0.7919,
            },
          },
        },
        usage: { input_tokens: 333, output_tokens: 0 },
      },
      success: true,
      errors: [],
      messages: [],
    };
    expect(
      fromSystemOneResponse(recordedClefResponse, questions, {
        provider: "cloudflare.clef",
        model: "clef",
      }),
    ).toEqual({
      model: "clef",
      answers: {
        urgent: { type: "boolean", probability: 0.8469 },
        team: {
          type: "choice",
          choice: "billing",
          confidence: 0.4094,
          probabilities: { billing: 0.8199, technical: 0.1801 },
        },
        severity: {
          type: "score",
          score: 2.7709,
          level: "Critical",
          confidence: 0.5522,
          probabilities: {
            None: 0.0049,
            Minor: 0.0112,
            Major: 0.192,
            Critical: 0.7919,
          },
        },
      },
      usage: { inputTokens: 333, outputTokens: 0 },
    });
  });

  it("matches score probabilities by level index, so the legend text doesn't matter", () => {
    const result = fromSystemOneResponse(
      withAnswer("severity", {
        type: "score",
        score: 1,
        confidence: 0.4,
        probabilities: { "1": 0.7, "2": 0.3 },
      }),
      questions,
      provider,
    );
    expect(result.answers.severity).toEqual({
      type: "score",
      score: 1,
      level: "Minor",
      confidence: 0.4,
      probabilities: { None: 0, Minor: 0.7, Major: 0.3, Critical: 0 },
    });
  });

  it("does not read an answer from the prototype chain", () => {
    // Without an own-property check, answers["__proto__"] would return
    // Object.prototype and be treated as a (malformed) answer.
    expect(() =>
      fromSystemOneResponse(
        { model: "m", answers: {} },
        JSON.parse(
          '{"__proto__": {"type": "boolean", "instructions": "x"}}',
        ) as DecisionQuestionMap,
        provider,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "llm.invalid_response_shape",
        message: 'Decision response has no answer for "__proto__".',
      }),
    );
  });

  it.each([
    ["not an object", 42],
    ["answers as an array", { model: "m", answers: [] }],
    [
      "a failed Cloudflare envelope",
      { result: null, success: false, errors: [{ code: 7000 }] },
    ],
    [
      "a missing answer",
      {
        ...recordedJevResponse,
        answers: { urgent: recordedJevResponse.answers.urgent },
      },
    ],
    [
      "a choice answer for a boolean question",
      withAnswer("urgent", { type: "choice", choice: "billing" }),
    ],
    ["a non-numeric noul", withAnswer("urgent", { type: "noul", noul: "yes" })],
    [
      "a choice outside the options",
      withAnswer("team", {
        type: "choice",
        choice: "sales",
        confidence: 1,
        probabilities: { billing: 0.5, technical: 0.5 },
      }),
    ],
    [
      "probabilities as an array",
      withAnswer("team", {
        type: "choice",
        choice: "billing",
        confidence: 1,
        probabilities: [0.5, 0.5],
      }),
    ],
    [
      "a score index that isn't a whole number",
      withAnswer("severity", {
        type: "score",
        score: 1,
        confidence: 1,
        probabilities: { "1.0": 1 },
      }),
    ],
    [
      "a score index out of range",
      withAnswer("severity", {
        type: "score",
        score: 1,
        confidence: 1,
        probabilities: { "7": 1 },
      }),
    ],
  ])("throws llm.invalid_response_shape for %s", (_label, raw) => {
    expect(() => fromSystemOneResponse(raw, questions, provider)).toThrow(
      expect.objectContaining({
        code: "llm.invalid_response_shape",
        context: expect.objectContaining({
          operation: "systemone.response",
          provider: "typesafe.systemone",
        }),
      }),
    );
  });
});
