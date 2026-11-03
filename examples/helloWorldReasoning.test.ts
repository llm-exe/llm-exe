import { useLlm } from "llm-exe";
import { helloWorldReasoning } from "./helloWorldReasoning";


describe("verifyBot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify (false) based on the questions/content", async () => {

    const llm = useLlm("openai.chat.v1", {
      model: "gpt-6-luna",
      openAiApiKey: process.env.OPENAI_API_KEY,
    });

    // the input you get from somewhere
    const input = "Hi can you hear me?";

    const hello = await  helloWorldReasoning(llm, input)

    console.log(hello)

  });
});
