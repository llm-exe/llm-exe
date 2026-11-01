import { useLlm } from "./llm";
import { apiRequest } from "@/utils/modules/request";
import { createLlmExecutor } from "@/executor";
import { createChatPrompt } from "@/prompt";
import { createParser } from "@/parser";

jest.mock("@/utils/modules/request", () => ({ apiRequest: jest.fn() }));
const request = jest.mocked(apiRequest);

describe("openai.chat-mock.v1 mockResponse (issue #866)", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("returns the fixed echo string when mockResponse is not set", async () => {
    const llm = useLlm("openai.chat-mock.v1", { model: "mock" });
    const out = await llm.call([{ role: "user", content: "hi" }]);
    expect(out.getResultText()).toBe(
      'Hello world from LLM! The input was [{"role":"user","content":"hi"}]'
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("returns mockResponse verbatim as the assistant text", async () => {
    const llm = useLlm("openai.chat-mock.v1", {
      model: "mock",
      mockResponse: '{"a":1}',
    });
    const out = await llm.call([{ role: "user", content: "hi" }]);
    expect(out.getResultText()).toBe('{"a":1}');
    expect(request).not.toHaveBeenCalled();
  });

  it("returns an empty mockResponse instead of the fallback string", async () => {
    const llm = useLlm("openai.chat-mock.v1", {
      model: "mock",
      mockResponse: "",
    });
    const out = await llm.call("hi");
    expect(out.getResultText()).toBe("");
  });

  it("does not require a model", async () => {
    const llm = useLlm("openai.chat-mock.v1", { mockResponse: "ok" });
    const out = await llm.call("hi");
    expect(out.getResultText()).toBe("ok");
  });

  it("keeps mockResponse in llm state (declared option)", () => {
    const llm = useLlm("openai.chat-mock.v1", {
      model: "mock",
      mockResponse: "x",
    });
    expect(llm.getMetadata()).toHaveProperty("mockResponse", "x");
  });

  it("lets typed parsers succeed end-to-end without a key or server", async () => {
    const schema = {
      type: "object",
      properties: { a: { type: "number" } },
      required: ["a"],
    } as const;
    const executor = createLlmExecutor({
      llm: useLlm("openai.chat-mock.v1", {
        model: "mock",
        mockResponse: '{"a":1}',
      }),
      prompt: createChatPrompt<{ text: string }>("Extract: {{text}}"),
      parser: createParser("json", { schema }),
    });
    const result = await executor.execute({ text: "anything" });
    const a: number = result.a;
    expect(a).toBe(1);
  });

  it("supports the number and listToArray parsers", async () => {
    const num = createLlmExecutor({
      llm: useLlm("openai.chat-mock.v1", { model: "mock", mockResponse: "42" }),
      prompt: createChatPrompt("How many?"),
      parser: createParser("number"),
    });
    expect(await num.execute({})).toBe(42);

    const list = createLlmExecutor({
      llm: useLlm("openai.chat-mock.v1", {
        model: "mock",
        mockResponse: "- one\n- two",
      }),
      prompt: createChatPrompt("List"),
      parser: createParser("listToArray"),
    });
    expect(await list.execute({})).toEqual(["one", "two"]);
  });
});
