import { handler } from "./lambdaHandler";

describe("lambdaHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("classifies feedback and returns a JSON response", async () => {
    const response = await handler({
      feedback: "Your support team resolved my issue in five minutes. Amazing!",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(["praise", "complaint", "question"]).toContain(body.category);
  });
});
