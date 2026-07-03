import { summarize, createSummarizer } from "./retryAndTimeout";

describe("retryAndTimeout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a one-sentence summary", async () => {
    const result = await summarize(
      "The quick brown fox jumped over the lazy dog. The dog did not react. The fox wandered off into the forest looking for something else to do."
    );
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  it("creates an executor with hooks support", () => {
    const summarizer = createSummarizer();
    const noop = () => undefined;
    summarizer.on("onError", noop);
    expect(summarizer.getHookCount("onError")).toBe(1);
    summarizer.off("onError", noop);
    expect(summarizer.getHookCount("onError")).toBe(0);
  });
});
