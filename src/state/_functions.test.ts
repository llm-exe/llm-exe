import {
  BaseState,
  BaseStateItem,
  DefaultState,
  createState,
  createStateItem,
} from "@/state";
import * as pkg from "@/index";
import { createStateFrom } from "@/state/_functions";

/**
 * Tests the TextPrompt class
 */
describe("llm-exe:state/createStateFrom", () => {
  it("creates empty state if nothing provided", () => {
    const state = createStateFrom();
    expect(state).toBeInstanceOf(DefaultState);
    expect(state).toBeInstanceOf(BaseState);
  });

  it("creates empty state if empty object provided", async () => {
    const state = createStateFrom({});
    expect(state).toBeInstanceOf(DefaultState);
    expect(state).toBeInstanceOf(BaseState);
  });

  it("creates empty state if empty object provided", async () => {
    const state = createState();

    state.setAttribute("something", "someValue")

    const chat = state.createDialogue("chat");
    chat.setUserMessage("Hello");
    chat.setAssistantMessage("Hello There!!");

    const saved = state.serialize();
    const newState = createStateFrom(saved);
    expect(newState).toHaveProperty("dialogues");
    expect(newState.dialogues).toHaveProperty("chat");

    expect(newState).toHaveProperty("attributes");
    expect(newState.attributes).toHaveProperty("something");
    expect(newState.attributes.something).toEqual("someValue");
  });

  it("round-trips dialogues, context and attributes through JSON", () => {
    const state = createState();
    state.setAttribute("something", "someValue");
    const chat = state.createDialogue("chat");
    chat.setUserMessage("Hello");
    chat.setAssistantMessage("Hello There!!");
    state.createContextItem(createStateItem("userIntent", "none"));
    state.getContext<string>("userIntent").setValue("booking");
    state.createContextItem(createStateItem("count", 0));
    state.getContext<number>("count").setValue(3);
    state.createContextItem(createStateItem("tags", [] as string[]));
    state.getContext<string[]>("tags").setValue(["a", "b"]);

    const saved = JSON.parse(JSON.stringify(state.serialize()));
    const restored = createStateFrom(saved);

    expect(restored.getContext("userIntent")).toBeInstanceOf(BaseStateItem);
    expect(restored.getContextValue("userIntent")).toEqual("booking");
    expect(restored.getContextValue("count")).toEqual(3);
    expect(restored.getContextValue("tags")).toEqual(["a", "b"]);
    expect(restored.getDialogue("chat").getHistory()).toEqual(
      chat.getHistory()
    );
    expect(restored.attributes).toEqual({ something: "someValue" });
    expect(restored.serialize()).toEqual(saved);
  });

  it("accepts a raw (unwrapped) context value", () => {
    const restored = createStateFrom({
      context: { userIntent: { name: "userIntent", value: "booking" } },
    });
    expect(restored.getContextValue("userIntent")).toEqual("booking");
  });

  it("is exported from the package entry", () => {
    expect(pkg.createStateFrom).toBe(createStateFrom);
  });
});
