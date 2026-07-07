import { analyzeReview } from "./typeSafeLlmFunction";

describe("typeSafeLlmFunction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a typed analysis matching the schema", async () => {
    const result = await analyzeReview(
      "This coffee maker is fantastic. Brews fast, easy to clean, and looks great on the counter. Five stars."
    );

    expect(["positive", "neutral", "negative"]).toContain(result.sentiment);
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
    expect(typeof result.actionNeeded).toBe("boolean");
  });
});
