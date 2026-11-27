import { DefaultState } from "./index";
import { Dialogue } from "./dialogue";
import { DefaultStateItem } from "./item";

export function createState() {
  return new DefaultState();
}
export function createDialogue(name: string) {
  return new Dialogue(name);
}

export function createStateItem<T>(
  name: string,
  defaultValue: T
): DefaultStateItem<T> {
  return new DefaultStateItem<T>(name, defaultValue);
}

export function createStateFrom(savedState?: any) {
  const state = createState();
  const dialogues = savedState?.dialogues || {};
  const context = savedState?.context || {};
  const attributes = savedState?.attributes || {};

  for (const dialogue of Object.keys(dialogues)) {
    const value = dialogues[dialogue].value;
    state.createDialogue(dialogue).setHistory(value);
  }

  for (const key of Object.keys(context)) {
    const item = context[key];
    const name = typeof item?.name === "string" ? item.name : key;
    state.createContextItem(
      new DefaultStateItem(name, unwrapContextValue(name, item?.value))
    );
  }

  for (const attribute of Object.keys(attributes)) {
    state.setAttribute(attribute, attributes[attribute]);
  }
  return state;
}

/**
 * BaseStateItem.serialize() stores `value` as `{ [name]: value }`.
 * Unwrap that shape; anything else is treated as the raw value.
 */
function unwrapContextValue(name: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, name)
  ) {
    return (value as Record<string, unknown>)[name];
  }
  return value;
}
