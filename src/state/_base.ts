import { assert } from "@/utils/modules/assert";
import { Dialogue } from "./dialogue";
import { BaseStateItem } from "./item";

export abstract class BaseState {
  public dialogues: { [key in string]: Dialogue } = {};
  public attributes: Record<string, any> = {};
  public context: Record<string, BaseStateItem<any>> = {};

  constructor() {}

  createDialogue(name: string = "defaultDialogue") {
    assert(!this.dialogues[name], `Dialogue already exists`);
    this.dialogues[name] = new Dialogue(name);
    return this.dialogues[name];
  }
  useDialogue(name: string = "defaultDialogue") {
    const dialogue = this.dialogues[name];
    if (!dialogue) {
      this.dialogues[name] = new Dialogue(name);
      return this.dialogues[name];
    }
    return dialogue;
  }
  getDialogue(name: string = "defaultDialogue") {
    const dialogue = this.dialogues[name];
    assert(dialogue, `Invalid dialogue ${name}`);
    return dialogue;
  }

  createContextItem<T extends BaseStateItem<any>>(item: T): T {
    assert(
      item instanceof BaseStateItem,
      "Invalid context item. Must be instance of BaseStateItem"
    );
    assert(
      !this.context[item?.getKey()],
      `key (${item?.getKey()}) already exists`
    );
    this.context[item.getKey()] = item;
    return this.context[item.getKey()] as any;
  }

  getContext<T>(key: string): BaseStateItem<T> {
    return this.context[key] as BaseStateItem<T>;
  }

  getContextValue<T>(key: string): T {
    return this.context[key]?.getValue();
  }

  setAttribute(key: string, value: any) {
    // These keys write to the prototype chain instead of setting a plain
    // property, letting one state's attribute leak into every object.
    assert(
      !["__proto__", "constructor", "prototype"].includes(key),
      `Invalid attribute key (${key})`
    );
    this.attributes[key] = value;
  }

  deleteAttribute(key: string) {
    delete this.attributes[key];
  }

  clearAttributes() {
    this.attributes = {};
  }

  serialize() {
    const dialogues: any = {};
    const context: any = {};
    const attributes: any = { ...this.attributes };

    const dialogueKeys = Object.keys(
      this.dialogues
    ) as (keyof typeof this.dialogues)[];
    for (const dialogueKey of dialogueKeys) {
      dialogues[dialogueKey] = this.dialogues[dialogueKey].serialize();
    }

    const contextKeys = Object.keys(
      this.context
    ) as (keyof typeof this.context)[];
    for (const contextKey of contextKeys) {
      context[contextKey] = this.context[contextKey].serialize();
    }

    return {
      dialogues,
      context,
      attributes,
    };
  }

  abstract saveState(): Promise<void>;
}

export class DefaultState extends BaseState {
  constructor() {
    super();
  }
  async saveState() {
    console.log("Save not implemented in default state.");
  }
}
