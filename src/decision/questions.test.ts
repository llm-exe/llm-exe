import { assertValidDecisionQuestions } from "./questions";

const limits = { maxQuestions: 3, operation: "test" };

function expectInvalid(questions: unknown, option: string) {
  expect(() => assertValidDecisionQuestions(questions, limits)).toThrow(
    expect.objectContaining({
      code: "configuration.incompatible_options",
      context: expect.objectContaining({ option, operation: "test" }),
    }),
  );
}

describe("assertValidDecisionQuestions", () => {
  it("accepts one question of each type", () => {
    expect(() =>
      assertValidDecisionQuestions(
        {
          urgent: { type: "boolean", instructions: "Is it urgent?" },
          team: {
            type: "choice",
            instructions: "Which team?",
            options: { billing: "Payments", technical: "Outages" },
          },
          severity: {
            type: "score",
            instructions: "How severe?",
            levels: ["Low", { label: "High", description: "Money lost" }],
          },
        },
        limits,
      ),
    ).not.toThrow();
  });

  it.each([
    ["an array", [], "questions"],
    ["null", null, "questions"],
    ["an empty map", {}, "questions"],
    [
      "more than maxQuestions",
      Object.fromEntries(
        ["a", "b", "c", "d"].map((name) => [
          name,
          { type: "boolean", instructions: "x" },
        ]),
      ),
      "questions",
    ],
  ])("rejects %s", (_label, questions, option) => {
    expectInvalid(questions, option);
  });

  it.each(["has space", "", "a".repeat(101), "slash/name"])(
    "rejects the question name %p",
    (name) => {
      expectInvalid(
        { [name]: { type: "boolean", instructions: "x" } },
        `questions.${name}`,
      );
    },
  );

  it.each([
    ["not an object", "Is it?", "questions.q"],
    [
      "an unknown type",
      { type: "rating", instructions: "x" },
      "questions.q.type",
    ],
    ["missing instructions", { type: "boolean" }, "questions.q.instructions"],
    [
      "blank instructions",
      { type: "boolean", instructions: "  " },
      "questions.q.instructions",
    ],
    [
      "choice without options",
      { type: "choice", instructions: "x" },
      "questions.q.options",
    ],
    [
      "choice with options as an array",
      { type: "choice", instructions: "x", options: ["a"] },
      "questions.q.options",
    ],
    [
      "choice with no options",
      { type: "choice", instructions: "x", options: {} },
      "questions.q.options",
    ],
    [
      "choice with 256 options",
      {
        type: "choice",
        instructions: "x",
        options: Object.fromEntries(
          Array.from({ length: 256 }, (_, i) => [`o${i}`, "d"]),
        ),
      },
      "questions.q.options",
    ],
    [
      "choice with a non-string description",
      { type: "choice", instructions: "x", options: { a: 1 } },
      "questions.q.options",
    ],
    [
      "choice with an empty option key",
      { type: "choice", instructions: "x", options: { "": "d" } },
      "questions.q.options",
    ],
    [
      "score with one level",
      { type: "score", instructions: "x", levels: ["Only"] },
      "questions.q.levels",
    ],
    [
      "score with 11 levels",
      {
        type: "score",
        instructions: "x",
        levels: Array.from({ length: 11 }, (_, i) => `L${i}`),
      },
      "questions.q.levels",
    ],
    [
      "score with a blank level",
      { type: "score", instructions: "x", levels: ["Low", " "] },
      "questions.q.levels",
    ],
    [
      "score with a level missing its label",
      {
        type: "score",
        instructions: "x",
        levels: ["Low", { description: "d" }],
      },
      "questions.q.levels",
    ],
    [
      "score with a non-string description",
      {
        type: "score",
        instructions: "x",
        levels: ["Low", { label: "High", description: 5 }],
      },
      "questions.q.levels",
    ],
    [
      "score with duplicate labels",
      { type: "score", instructions: "x", levels: ["Low", { label: "Low" }] },
      "questions.q.levels",
    ],
  ])("rejects a question that is %s", (_label, question, option) => {
    expectInvalid({ q: question }, option);
  });

  it("accepts the boundary sizes: 2 and 10 levels, 1 and 255 options", () => {
    expect(() =>
      assertValidDecisionQuestions(
        {
          two: { type: "score", instructions: "x", levels: ["a", "b"] },
          ten: {
            type: "score",
            instructions: "x",
            levels: Array.from({ length: 10 }, (_, i) => `L${i}`),
          },
          many: {
            type: "choice",
            instructions: "x",
            options: Object.fromEntries(
              Array.from({ length: 255 }, (_, i) => [`o${i}`, "d"]),
            ),
          },
        },
        limits,
      ),
    ).not.toThrow();
    expect(() =>
      assertValidDecisionQuestions(
        { one: { type: "choice", instructions: "x", options: { only: "d" } } },
        limits,
      ),
    ).not.toThrow();
  });
});
