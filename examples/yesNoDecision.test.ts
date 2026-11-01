import { yesNo } from "./yesNoDecision";

describe("yesNoDecision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("answers yes for a clearly true question", async () => {
    const result = await yesNo("Is Paris the capital of France?");
    expect(typeof result).toBe("boolean");
    expect(result).toBe(true);
  });

  it("answers no for a clearly false question", async () => {
    const result = await yesNo("Is the number 3 an even number?");
    expect(typeof result).toBe("boolean");
    expect(result).toBe(false);
  });
});
