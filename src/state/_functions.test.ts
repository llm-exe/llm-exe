import {
  BaseState,
  BaseStateItem,
  DefaultState,
  DefaultStateItem,
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
    // Set values through the item references, so this doesn't depend on
    // whether getContext() is typed as possibly undefined (#976).
    const intent = createStateItem("userIntent", "none");
    const count = createStateItem("count", 0);
    const tags = createStateItem<string[]>("tags", []);
    for (const item of [intent, count, tags]) state.createContextItem(item);
    intent.setValue("booking");
    count.setValue(3);
    tags.setValue(["a", "b"]);

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

describe("llm-exe:state/createStateItem typing", () => {
  it("preserves the type parameter from the default value", () => {
    const intent = createStateItem("userIntent", "unknown");
    expect(intent).toBeInstanceOf(DefaultStateItem);
    const value: string = intent.getValue();
    expect(value).toBe("unknown");
    // @ts-expect-error - number is not assignable to string
    const asNumber: number = intent.getValue();
    expect(asNumber).toBe("unknown");
    // @ts-expect-error - setValue only accepts string
    expect(() => intent.setValue(12345)).toThrow("Invalid value type");
  });

  it("accepts an explicit type parameter", () => {
    const item = createStateItem<string | null>("maybe", null);
    item.setValue("hello");
    const value: string | null = item.getValue();
    expect(value).toBe("hello");
  });
});
