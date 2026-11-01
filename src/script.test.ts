import * as script from "./script";

/**
 * `src/script.ts` is the entry point for the browser (IIFE) bundle —
 * see the `build:browser` script in package.json. Nothing else imports it,
 * so a dropped or renamed export here fails silently: the build still
 * succeeds and ships a bundle missing part of its public surface.
 *
 * These tests pin the exported surface and assert each export is usable,
 * not merely present.
 */
describe("script (browser bundle entry)", () => {
  const expectedExports = [
    // prompt
    "BasePrompt",
    "ChatPrompt",
    "TextPrompt",
    "createPrompt",
    "createChatPrompt",
    // parser
    "BaseParser",
    "CustomParser",
    "LlmNativeFunctionParser",
    "createParser",
    "createCustomParser",
    // state
    "DefaultState",
    "BaseStateItem",
    "DefaultStateItem",
    "createState",
    "createStateItem",
    "createDialogue",
  ];

  it("exports exactly the documented browser surface", () => {
    expect(Object.keys(script).sort()).toEqual([...expectedExports].sort());
  });

  it.each(expectedExports)("exports %s as a constructor or factory", (name) => {
    expect(typeof (script as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports no undefined bindings", () => {
    for (const [name, value] of Object.entries(script)) {
      expect([name, value]).not.toEqual([name, undefined]);
    }
  });

  describe("exports are functional, not just present", () => {
    it("createChatPrompt builds and formats a chat prompt", () => {
      const prompt = script.createChatPrompt<{ name: string }>("Hi {{name}}");
      const messages = prompt.format({ name: "Ada" });
      expect(messages).toEqual([{ role: "system", content: "Hi Ada" }]);
    });

    it("createPrompt builds and formats a text prompt", () => {
      const prompt = script.createPrompt<{ name: string }>("text", "Hi {{name}}");
      expect(prompt.format({ name: "Ada" })).toEqual("Hi Ada");
    });

    it("createParser returns a working parser", () => {
      const parser = script.createParser("json");
      expect(parser.parse('{"a":1}')).toEqual({ a: 1 });
    });

    it("createCustomParser returns a working parser", () => {
      const parser = script.createCustomParser("upper", (input: string) =>
        input.toUpperCase()
      );
      expect(parser.parse("abc")).toEqual("ABC");
    });

    it("createDialogue tracks chat history", () => {
      const dialogue = script.createDialogue("chat");
      dialogue.setUserMessage("hello");
      expect(dialogue.getHistory()).toEqual([
        { role: "user", content: "hello" },
      ]);
    });

    it("createState stores attributes and serializes them", () => {
      const state = script.createState();
      state.setAttribute("greeting", "hello");
      expect(state.serialize().attributes).toEqual({ greeting: "hello" });
    });

    it("createState stores and retrieves context items", () => {
      const state = script.createState();
      state.createContextItem(script.createStateItem("greeting", "hello"));
      expect(state.getContextValue("greeting")).toEqual("hello");
    });

    it("createStateItem wraps a keyed value", () => {
      const item = script.createStateItem("greeting", "hello");
      expect(item.getKey()).toEqual("greeting");
      expect(item.getValue()).toEqual("hello");
    });

    it("classes are constructible via their exported bindings", () => {
      expect(new script.ChatPrompt("hello")).toBeInstanceOf(script.BasePrompt);
      expect(new script.TextPrompt("hello")).toBeInstanceOf(script.BasePrompt);
      expect(new script.DefaultStateItem("k", "v")).toBeInstanceOf(
        script.BaseStateItem
      );
      expect(
        new script.CustomParser("noop", (i: string) => i)
      ).toBeInstanceOf(script.BaseParser);
    });
  });
});
