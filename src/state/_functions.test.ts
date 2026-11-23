import { BaseState, DefaultState, createState } from "@/state";
import { createStateFrom, createStateItem } from "@/state/_functions";
import { DefaultStateItem } from "@/state/item";

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
