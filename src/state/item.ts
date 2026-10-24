import { Serializable } from "@/types";
import { assert } from "@/utils/modules/assert";

/**
 * Shallow-copy arrays and plain objects so `value` never aliases
 * `initialValue`; in-place mutations would otherwise survive resetValue().
 */
function copyInitialValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as T;
  }
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return { ...value };
  }
  return value;
}

export abstract class BaseStateItem<T> implements Serializable {
  protected key: string;
  protected value: T;
  protected initialValue: T;

  constructor(key: string, initialValue: T) {
    this.key = key;
    this.initialValue = initialValue;
    this.value = copyInitialValue(initialValue);
  }
  setValue(value: T) {
    if (this.value !== undefined && this.value !== null) {
      assert(
        typeof value === typeof this.value,
        `Invalid value type. Expected ${typeof this.value}, received ${typeof value}`
      );
    }
    this.value = value;
  }
  getKey() {
    return this.key;
  }
  getValue(): T {
    return this.value;
  }
  resetValue() {
    this.value = copyInitialValue(this.initialValue);
  }
  serializeValue() {
    return {
      [this.getKey()]: this.getValue(),
    };
  }
  serialize(): { class: string; name: string; value: any } {
    return {
      class: "BaseStateItem",
      name: this.getKey(),
      value: this.serializeValue(),
    };
  }
  // deserialize() {}
}

export class DefaultStateItem extends BaseStateItem<any> {
  constructor(name: string, defaultValue: any) {
    super(name, defaultValue);
  }
  // serialize() { return {}; }
  // deserialize() {}
}
