import {
  BaseState,
  DefaultState,
  DefaultStateItem,
  Dialogue,
  createState,
  createStateItem,
} from "@/state";

/**
 * Tests the TextPrompt class
 */
describe("llm-exe:state/BaseState", () => {
  class MockState extends BaseState {
    constructor() {
      super();
    }
    async saveState() {}
  }

  it("creates class with expected properties", () => {
    const state = createState();
    expect(state).toBeInstanceOf(DefaultState);
    expect(state).toBeInstanceOf(BaseState);
  });
  it("creates class with expected properties", () => {
    const state = new MockState();
    expect(state).toHaveProperty("dialogues");
    expect(state).toHaveProperty("attributes");
    expect(state).toHaveProperty("context");
  });
  it("creates DefaultState class with expected properties", () => {
    const state = new DefaultState();
    expect(state).toHaveProperty("dialogues");
    expect(state).toHaveProperty("attributes");
    expect(state).toHaveProperty("context");
  });

  it("creates class with expected properties", () => {
    const state = new MockState();
    expect(state).toHaveProperty("createDialogue");
    expect(typeof state.createDialogue).toEqual("function");

    expect(state).toHaveProperty("useDialogue");
    expect(typeof state.useDialogue).toEqual("function");

    expect(state).toHaveProperty("getDialogue");
    expect(typeof state.getDialogue).toEqual("function");

    expect(state).toHaveProperty("createContextItem");
    expect(typeof state.createContextItem).toEqual("function");

    expect(state).toHaveProperty("getContext");
    expect(typeof state.getContext).toEqual("function");

    expect(state).toHaveProperty("getContextValue");
    expect(typeof state.getContextValue).toEqual("function");

    expect(state).toHaveProperty("setAttribute");
    expect(typeof state.setAttribute).toEqual("function");

    expect(state).toHaveProperty("deleteAttribute");
    expect(typeof state.deleteAttribute).toEqual("function");

    expect(state).toHaveProperty("clearAttributes");
    expect(typeof state.clearAttributes).toEqual("function");

    expect(state).toHaveProperty("serialize");
    expect(typeof state.serialize).toEqual("function");

    expect(state).toHaveProperty("saveState");
    expect(typeof state.saveState).toEqual("function");
  });
  it("state.createDialogue with default name", () => {
    const state = new MockState();
    const dialogue = state.createDialogue();
    expect(state).toHaveProperty("dialogues");
    expect(state.dialogues).toHaveProperty("defaultDialogue");
    expect(state.dialogues).toHaveProperty("defaultDialogue");
    expect(state.dialogues["defaultDialogue"]).toBeInstanceOf(Dialogue);
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.createDialogue with set name", () => {
    const state = new MockState();
    const dialogue = state.createDialogue("main");
    expect(state).toHaveProperty("dialogues");
    expect(state.dialogues).toHaveProperty("main");
    expect(state.dialogues["main"]).toBeInstanceOf(Dialogue);
    expect(dialogue).toBeInstanceOf(Dialogue);
  });

  it("state.createDialogue with error if exists", () => {
    const state = new MockState();
    state.createDialogue("main");
    expect(() => state.createDialogue("main")).toThrowError(
      "Dialogue already exists"
    );
  });

  it("state.createDialogue with default name", () => {
    const state = new MockState();
    const dialogue = state.createDialogue();
    expect(state).toHaveProperty("dialogues");
    expect(state.dialogues).toHaveProperty("defaultDialogue");
    expect(state.dialogues).toHaveProperty("defaultDialogue");
    expect(state.dialogues["defaultDialogue"]).toBeInstanceOf(Dialogue);
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.useDialogue with default", () => {
    const state = new MockState();
    const dialogue = state.useDialogue();
    expect(state.dialogues).toHaveProperty("defaultDialogue");
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.useDialogue with existing", () => {
    const state = new MockState();
    state.createDialogue("chat");
    expect(state.dialogues).toHaveProperty("chat");
    expect(state.dialogues["chat"]).toBeInstanceOf(Dialogue);
    const dialogue = state.useDialogue("chat");
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.useDialogue with new", () => {
    const state = new MockState();
    const dialogue = state.useDialogue("chat");
    expect(state.dialogues).toHaveProperty("chat");
    expect(state.dialogues["chat"]).toBeInstanceOf(Dialogue);
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.getDialogue with default name", () => {
    const state = new MockState();
    state.createDialogue();
    const dialogue = state.getDialogue();
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.getDialogue with existing", () => {
    const state = new MockState();
    state.createDialogue("chat");
    expect(state.dialogues).toHaveProperty("chat");
    expect(state.dialogues["chat"]).toBeInstanceOf(Dialogue);
    const dialogue = state.getDialogue("chat");
    expect(dialogue).toBeInstanceOf(Dialogue);
  });
  it("state.getDialogue with not existing", () => {
    const state = new MockState();
    state.createDialogue("chat");
    expect(() => state.getDialogue("chat-2")).toThrowError(
      "Invalid dialogue chat-2"
    );
  });

  it("state.serialize", () => {
    const state = new MockState();
    const dialogue1 = state.createDialogue("chat");
    dialogue1.setSystemMessage("This is the system message.");
    dialogue1.setUserMessage("This is the user message");
    dialogue1.setAssistantMessage("Hello, this is the assistant");

    const dialogue2 = state.createDialogue("chat-2");
    dialogue2.setSystemMessage("This is the system message.");
    dialogue2.setUserMessage("This is the user message");
    dialogue2.setAssistantMessage("Hello, this is the assistant");

    state.createContextItem(createStateItem("mock-item", {test: "val"}))

    expect(state.serialize()).toEqual({
      attributes: {},
      context: {
        "mock-item": {
          class: "BaseStateItem",
          name: "mock-item",
          value: {"mock-item": { test: "val" }},
        }
      },
      dialogues: {
        chat: {
          class: "Dialogue",
          name: "chat",
          value: [
            { role: "system", content: "This is the system message." },
            { role: "user", content: "This is the user message" },
            { role: "assistant", content: "Hello, this is the assistant" },
          ],
        },
        "chat-2": {
          class: "Dialogue",
          name: "chat-2",
          value: [
            { role: "system", content: "This is the system message." },
            { role: "user", content: "This is the user message" },
            { role: "assistant", content: "Hello, this is the assistant" },
          ],
        },
      },
    });
  });

  it("state.setAttribute sets attribute", () => {
    const state = new MockState();
    state.setAttribute("foo", "bar");
    expect(state.attributes).toHaveProperty("foo");
    expect(state.attributes.foo).toEqual("bar");
  });
  it("state.setAttribute rejects prototype-polluting keys", () => {
    const state = new MockState();
    for (const key of ["__proto__", "constructor", "prototype"]) {
      expect(() => state.setAttribute(key, { polluted: "yes" })).toThrow(
        `Invalid attribute key (${key})`
      );
    }
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(state.attributes)).toBe(Object.prototype);
  });
  it("state.deleteAttribute deletes attribute", () => {
    const state = new MockState();
    state.setAttribute("foo", "bar");
    expect(state.attributes).toHaveProperty("foo");
    expect(state.attributes.foo).toEqual("bar");
    state.deleteAttribute("foo");
    expect(state.attributes).not.toHaveProperty("foo");
  });

  it("state.clearAttributes deletes attributes", () => {
    const state = new MockState();
    state.setAttribute("foo", "bar");
    state.setAttribute("bar", "foo");
    expect(state.attributes).toHaveProperty("foo");
    expect(state.attributes.foo).toEqual("bar");
    expect(state.attributes).toHaveProperty("bar");
    expect(state.attributes.bar).toEqual("foo");

    state.clearAttributes();
    expect(state.attributes).toEqual({});
  });

  it("state.createContextItem error if invalid", () => {
    const state = new MockState();
    expect(() => state.createContextItem({} as any)).toThrowError(
      "Invalid context item. Must be instance of BaseStateItem"
    );
  });

  it("state.createContextItem creates if valid", () => {
    const state = new MockState();
    const context = state.createContextItem(
      createStateItem("user", { name: "Greg" })
    );
    expect(context).toBeInstanceOf(DefaultStateItem);
    expect(state.context).toHaveProperty("user");
    expect(state.context["user"].getValue()).toEqual({ name: "Greg" });
  });

  it("state.createContextItem error if exists", () => {
    const state = new MockState();
    state.createContextItem(createStateItem("user", { name: "Greg" }));
    expect(() =>
      state.createContextItem(createStateItem("user", { name: "Greg" }))
    ).toThrowError("key (user) already exists");
  });

  it("state.getContext gets context item", () => {
    const state = new MockState();
    const value = { name: "Greg" };
    state.createContextItem(createStateItem("user", value));
    const context = state.getContext<typeof value>("user");
    expect(context).toBeInstanceOf(DefaultStateItem);
    expect(context.getValue()).toEqual({ name: "Greg" });
  });

  it("state.getContext gets context item", () => {
    const state = new MockState();
    const value = { name: "Greg" };
    state.createContextItem(createStateItem("user", value));
    const contextValue = state.getContextValue<typeof value>("user");
    expect(contextValue).toEqual({ name: "Greg" });
  });

  it("DefaultState.saveState logs warning", async () => {
    const logSpy = jest.spyOn(console, "log");
    const state = new DefaultState();
    await state.saveState();
    expect(logSpy).toHaveBeenCalledWith(
      "Save not implemented in default state."
    );
  });
  it("state.getContext gets context item", async () => {
    const state = new MockState();
    await state.saveState();
  });

  it("createStateFrom recreated state", async () => {
    const state = new MockState();
    await state.saveState();
  });

  
});
