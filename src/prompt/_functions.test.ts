import {
  BasePrompt,
  ChatPrompt,
  TextPrompt,
  createChatPrompt,
  createPrompt,
} from "@/prompt";

/**
 * Tests createPrompt
 */
describe("llm-exe:prompt/createPrompt", () => {
  const defaultMessage = "You are a customer support agent.";
  it("defaults to text prompt", () => {
    const prompt = createPrompt();
    expect(prompt).toBeInstanceOf(BasePrompt);
    expect(prompt).toBeInstanceOf(TextPrompt);
    expect(prompt).toHaveProperty("type");
    expect(prompt.type).toEqual("text");
  });
  it("allows you to create text prompt", () => {
    const prompt = createPrompt("text");
    expect(prompt).toBeInstanceOf(BasePrompt);
    expect(prompt).toBeInstanceOf(TextPrompt);
    expect(prompt).toHaveProperty("type");
    expect(prompt.type).toEqual("text");
  });
  it("allows you to create text prompt with default message", () => {
    const prompt = createPrompt("text", defaultMessage);
    expect(prompt.messages[0]).toEqual({
      content: defaultMessage,
      role: "system",
    });
  });
  it("forwards options to text prompt (validateInput)", () => {
    const prompt = createPrompt<{ a: string }>("text", "Hi {{a}}", {
      validateInput: "strict",
    });
    expect(prompt.validateInput).toEqual("strict");
    expect(() => prompt.format({} as any)).toThrow();
  });
  it("forwards options to text prompt (helpers and partials)", () => {
    const prompt = createPrompt<{ a: string }>("text", "{{shout a}} {{> sig}}", {
      helpers: [
        { name: "shout", handler: (v: string) => String(v).toUpperCase() },
      ],
      partials: [{ name: "sig", template: "- bot" }],
    });
    expect(prompt.format({ a: "hi" })).toEqual("HI - bot");
  });
  it("forwards options when type is omitted", () => {
    const prompt = createPrompt<{ a: string }>(undefined, "Hi {{a}}", {
      validateInput: "strict",
    });
    expect(prompt).toBeInstanceOf(TextPrompt);
    expect(() => prompt.format({} as any)).toThrow();
  });
  it("allows you to create chat prompt", () => {
    const prompt = createPrompt("chat");
    expect(prompt).toBeInstanceOf(BasePrompt);
    expect(prompt).toBeInstanceOf(ChatPrompt);
    expect(prompt).toHaveProperty("type");
    expect(prompt.type).toEqual("chat");
  });
  it("allows you to create chat prompt with default system message", () => {
    const prompt = createPrompt("chat", defaultMessage);
    expect(prompt.messages[0]).toEqual({
      content: defaultMessage,
      role: "system",
    });
  });
  it("allows you to create chat prompt via createChatPrompt", () => {
    const prompt = createChatPrompt();
    expect(prompt).toBeInstanceOf(BasePrompt);
    expect(prompt).toBeInstanceOf(ChatPrompt);
    expect(prompt).toHaveProperty("type");
    expect(prompt.type).toEqual("chat");
  });
  it("allows you to create chat prompt with default system message via createChatPrompt", () => {
    const prompt = createChatPrompt(defaultMessage);
    expect(prompt.messages[0]).toEqual({
      content: defaultMessage,
      role: "system",
    });
  });
});
