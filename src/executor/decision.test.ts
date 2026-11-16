import { useDecisionModel } from "@/decision/decision";
import { createDecisionExecutor, DecisionExecutor } from "./decision";

const okBody = {
  model: "gpt-6-luna",
  answers: [
    { type: "predicate", name: "urgent", probability: 0.9 },
    {
      type: "choice",
      name: "team",
      choice: "technical",
      probabilities: [
        { value: "billing", probability: 0.2 },
        { value: "technical", probability: 0.8 },
      ],
      confidence: 0.7,
    },
  ],
  usage: { input_tokens: 30, output_tokens: 0 },
};

const questions = {
  urgent: { type: "boolean", instructions: "Is it urgent?" },
  team: {
    type: "choice",
    instructions: "Which team?",
    options: { billing: "Payments", technical: "Outages" },
  },
} as const;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createDecisionExecutor", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function model(options: Record<string, unknown> = {}) {
    return useDecisionModel("openai.gpt-6-luna", {
      openAiApiKey: "sk-test-key",
      maxDelay: 0,
      ...options,
    });
  }

  it("posts the questions to /decisions and returns typed answers", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, okBody));
    const executor = createDecisionExecutor(model(), questions);

    const result = await executor.execute({ input: "The site is down" });

    expect(result).toEqual({
      model: "gpt-6-luna",
      answers: {
        urgent: { type: "boolean", probability: 0.9 },
        team: {
          type: "choice",
          choice: "technical",
          confidence: 0.7,
          probabilities: { billing: 0.2, technical: 0.8 },
        },
      },
      usage: { inputTokens: 30, outputTokens: 0 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/decisions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk-test-key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-6-luna",
      input: "The site is down",
      questions: [
        { name: "urgent", type: "predicate", instructions: "Is it urgent?" },
        {
          name: "team",
          type: "choice",
          instructions: "Which team?",
          choices: [
            { value: "billing", description: "Payments" },
            { value: "technical", description: "Outages" },
          ],
        },
      ],
    });
  });

  it("uses a custom baseUrl and model with openai.decisions.v1", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, okBody));
    const custom = useDecisionModel("openai.decisions.v1", {
      model: "my-decider",
      baseUrl: "https://decisions.example.com/v1",
      openAiApiKey: "sk-test-key",
    });
    await createDecisionExecutor(custom, questions).execute({ input: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://decisions.example.com/v1/decisions");
    expect(JSON.parse(init.body).model).toBe("my-decider");
  });

  it("requires a model for openai.decisions.v1", () => {
    expect(() =>
      useDecisionModel("openai.decisions.v1", {
        openAiApiKey: "sk-test-key",
      } as never),
    ).toThrow(
      expect.objectContaining({
        code: "configuration.missing_option",
        context: expect.objectContaining({ option: "model" }),
      }),
    );
  });

  it("rejects bad questions when the executor is created, before any request", () => {
    expect(() =>
      createDecisionExecutor(model(), {
        severity: { type: "score", instructions: "How bad?", levels: ["Only"] },
      }),
    ).toThrow(
      expect.objectContaining({
        code: "configuration.incompatible_options",
        context: expect.objectContaining({
          operation: "createDecisionExecutor",
          option: "questions.severity.levels",
        }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the model's question limit", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 401 }, (_, i) => [
        `q${i}`,
        { type: "boolean" as const, instructions: "x" },
      ]),
    );
    expect(() => createDecisionExecutor(model(), tooMany)).toThrow(
      expect.objectContaining({ code: "configuration.incompatible_options" }),
    );
  });

  it.each([
    ["a number", 42],
    ["null", null],
  ])(
    "rejects %s as input without calling the provider",
    async (_label, input) => {
      const executor = createDecisionExecutor(model(), questions);
      await expect(executor.execute({ input } as never)).rejects.toMatchObject({
        code: "prompt.missing_input",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not retry a 400 from the provider", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: {
          message: "Invalid 'questions[0].levels': array too short.",
          type: "invalid_request_error",
          code: "array_below_min_length",
        },
      }),
    );
    const executor = createDecisionExecutor(
      model({ numOfAttempts: 3 }),
      questions,
    );
    await expect(executor.execute({ input: "x" })).rejects.toMatchObject({
      code: "llm.provider_invalid_request",
      context: expect.objectContaining({
        operation: "useDecisionModel_call",
        provider: "openai.decisions",
        model: "gpt-6-luna",
      }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(429, { error: { message: "slow down" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, okBody));
    const executor = createDecisionExecutor(
      model({ numOfAttempts: 2 }),
      questions,
    );
    const result = await executor.execute({ input: "x" });
    expect(result.answers.urgent).toEqual({
      type: "boolean",
      probability: 0.9,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a network failure as llm.provider_http_error", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    const executor = createDecisionExecutor(
      model({ numOfAttempts: 1 }),
      questions,
    );
    await expect(executor.execute({ input: "x" })).rejects.toMatchObject({
      code: "llm.provider_http_error",
      message: expect.stringContaining("socket hang up"),
      context: expect.objectContaining({
        operation: "useDecisionModel_call",
        provider: "openai.decisions",
      }),
    });
  });

  it("throws llm.invalid_response_shape when an answer is missing", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(200, { ...okBody, answers: okBody.answers.slice(0, 1) }),
    );
    const executor = createDecisionExecutor(model(), questions);
    await expect(executor.execute({ input: "x" })).rejects.toMatchObject({
      code: "llm.invalid_response_shape",
    });
    // Retried like a chat call's invalid_response_shape (default 2 attempts).
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("runs hooks and keeps the API key out of metadata", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, okBody));
    const onSuccess = jest.fn();
    const executor = createDecisionExecutor(model(), questions, {
      name: "triage",
      hooks: { onSuccess },
    });
    expect(executor).toBeInstanceOf(DecisionExecutor);
    await executor.execute({ input: "x" });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const metadata = executor.getMetadata();
    expect(metadata).toMatchObject({
      name: "triage",
      type: "decision-executor",
      questions: ["urgent", "team"],
    });
    expect(JSON.stringify(metadata)).not.toContain("sk-test-key");
  });

  it("throws configuration.invalid_provider for an unknown model key", () => {
    expect(() => useDecisionModel("openai.nope" as never)).toThrow(
      expect.objectContaining({
        code: "configuration.invalid_provider",
        context: expect.objectContaining({
          availableProviders: [
            "openai.decisions.v1",
            "openai.gpt-6-luna",
            "typesafe.systemone.v1",
            "typesafe.jev",
            "cloudflare.clef",
            "cloudflare.clef-flash",
          ],
        }),
      }),
    );
  });
});

describe("createDecisionExecutor with System One providers", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  const systemOneBody = {
    model: "jev-1.14.0",
    answers: {
      urgent: { type: "noul", noul: 0.9 },
      team: {
        type: "choice",
        choice: "technical",
        confidence: 0.6,
        probabilities: { billing: 0.2, technical: 0.8 },
      },
    },
    usage: { input_tokens: 30, output_tokens: 5 },
  };

  const expectedAnswers = {
    urgent: { type: "boolean", probability: 0.9 },
    team: {
      type: "choice",
      choice: "technical",
      confidence: 0.6,
      probabilities: { billing: 0.2, technical: 0.8 },
    },
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls TypeSafe Jev and returns the same answer shape as OpenAI", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, systemOneBody));
    const executor = createDecisionExecutor(
      useDecisionModel("typesafe.jev", { typesafeApiKey: "ts-test-key" }),
      questions,
    );

    const result = await executor.execute({ input: { body: "Site down" } });

    expect(result).toEqual({
      model: "jev-1.14.0",
      answers: expectedAnswers,
      usage: { inputTokens: 30, outputTokens: 5 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers.Authorization).toBe("Bearer ts-test-key");
    expect(JSON.parse(init.body)).toEqual({
      model: "jev-latest",
      state: { body: "Site down" },
      questions: {
        urgent: { type: "noul", instructions: "Is it urgent?" },
        team: {
          type: "choice",
          instructions: "Which team?",
          criteria: { billing: "Payments", technical: "Outages" },
        },
      },
    });
    expect(JSON.stringify(executor.getMetadata())).not.toContain("ts-test-key");
  });

  it("points typesafe.systemone.v1 at a self-hosted server", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, systemOneBody));
    await createDecisionExecutor(
      useDecisionModel("typesafe.systemone.v1", {
        model: "my-jev",
        baseUrl: "https://s1.internal.example/v1",
        typesafeApiKey: "ts-test-key",
      }),
      questions,
    ).execute({ input: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://s1.internal.example/v1/systemone");
    expect(JSON.parse(init.body).model).toBe("my-jev");
  });

  it.each([
    ["cloudflare.clef", "clef"],
    ["cloudflare.clef-flash", "clef-flash"],
  ] as const)(
    "calls Workers AI for %s and unwraps the result envelope",
    async (key, model) => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          result: systemOneBody,
          success: true,
          errors: [],
          messages: [],
        }),
      );
      const executor = createDecisionExecutor(
        useDecisionModel(key, {
          cloudflareApiToken: "cf-test-token",
          cloudflareAccountId: "abc123",
        }),
        questions,
      );

      const result = await executor.execute({ input: "x" });

      expect(result.answers).toEqual(expectedAnswers);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/accounts/abc123/ai/run/@cf/cloudflare/clef",
      );
      expect(init.headers.Authorization).toBe("Bearer cf-test-token");
      expect(JSON.parse(init.body).model).toBe(model);
      expect(JSON.stringify(executor.getMetadata())).not.toContain(
        "cf-test-token",
      );
    },
  );

  it("URL-encodes the Cloudflare account id in the path", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, systemOneBody));
    await createDecisionExecutor(
      useDecisionModel("cloudflare.clef", {
        cloudflareApiToken: "cf-test-token",
        cloudflareAccountId: "a/../b",
      }),
      questions,
    ).execute({ input: "x" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/a%2F..%2Fb/ai/run/@cf/cloudflare/clef",
    );
  });

  it("requires a Cloudflare account id", () => {
    // The env default is read when the config module loads, so load a fresh
    // copy with CLOUDFLARE_ACCOUNT_ID unset.
    const saved = process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    try {
      jest.isolateModules(() => {
        const fresh: typeof import("@/decision/decision") = jest.requireActual(
          "@/decision/decision",
        );
        expect(() =>
          fresh.useDecisionModel("cloudflare.clef", {
            cloudflareApiToken: "cf-test-token",
          }),
        ).toThrow(
          expect.objectContaining({
            code: "configuration.missing_option",
            context: expect.objectContaining({ option: "cloudflareAccountId" }),
          }),
        );
      });
    } finally {
      if (saved !== undefined) process.env.CLOUDFLARE_ACCOUNT_ID = saved;
    }
  });

  it("enforces Clef's 64-question limit when the executor is created", () => {
    const sixtyFive = Object.fromEntries(
      Array.from({ length: 65 }, (_, i) => [
        `q${i}`,
        { type: "boolean" as const, instructions: "x" },
      ]),
    );
    const clef = useDecisionModel("cloudflare.clef", {
      cloudflareApiToken: "cf-test-token",
      cloudflareAccountId: "abc123",
    });
    expect(clef.maxQuestions).toBe(64);
    expect(() => createDecisionExecutor(clef, sixtyFive)).toThrow(
      expect.objectContaining({ code: "configuration.incompatible_options" }),
    );
    const jev = useDecisionModel("typesafe.jev", {
      typesafeApiKey: "ts-test-key",
    });
    expect(() => createDecisionExecutor(jev, sixtyFive)).not.toThrow();
  });
});
