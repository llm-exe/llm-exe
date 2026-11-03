import { BaseStateItem } from "@/state";

/**
 * Tests the BaseStateItem class
 */
describe("llm-exe:state/BaseStateItem", () => {
    class MockStateItem<T> extends BaseStateItem<T> {
      constructor(key: string, initialValue: T) {
        super(key, initialValue);
      }
    }
  
    it("creates class with expected properties", () => {
      const defaultValue = "unknown"
      const item = new MockStateItem("intent", defaultValue);
      expect(item).toBeInstanceOf(BaseStateItem);
      expect(item).toHaveProperty("getKey");
      expect(item).toHaveProperty("setValue");
      expect(item).toHaveProperty("getValue");
      expect(item).toHaveProperty("resetValue");
      expect(item).toHaveProperty("serializeValue");
      expect(item).toHaveProperty("serialize");
    });

    it("item.getKey", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        expect(item.getKey()).toEqual("intent");
      });
      it("item.getValue", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        expect(item.getValue()).toEqual("unknown");
      });
      it("item.setValue", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        item.setValue("cancel_account")
        expect(item.getValue()).toEqual("cancel_account");
      });
      it("item.setValue", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        expect(() => item.setValue({} as any)).toThrowError("Invalid value type. Expected string, received object")
      });
      it("item.resetValue sets back to default", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        item.setValue("cancel_account")
        expect(item.getValue()).toEqual("cancel_account");

        item.resetValue()
        expect(item.getValue()).toEqual("unknown");
      });
      it("item.resetValue restores a non-primitive initial value after in-place mutation", () => {
        const item = new MockStateItem<string[]>("list", []);
        item.getValue().push("a");
        expect(item.getValue()).toEqual(["a"]);
        item.resetValue();
        expect(item.getValue()).toEqual([]);
        item.getValue().push("b");
        item.resetValue();
        expect(item.getValue()).toEqual([]);
      });
      it("item.resetValue restores a plain-object initial value after in-place mutation", () => {
        const item = new MockStateItem<Record<string, string>>("obj", { a: "1" });
        item.getValue().b = "2";
        item.resetValue();
        expect(item.getValue()).toEqual({ a: "1" });
      });
      it("item.serializeValue", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        expect(item.serializeValue()).toEqual({ intent: 'unknown' });
      });
      it("item.serialize", () => {
        const defaultValue = "unknown"
        const item = new MockStateItem("intent", defaultValue);
        expect(item.serialize()).toEqual({
                class: 'BaseStateItem',
                name: 'intent',
                value: { intent: 'unknown' }
        });
      });

      it("item.setValue allows setting value when initial value is undefined", () => {
        const item = new MockStateItem<string | undefined>("intent", undefined);
        item.setValue("hello");
        expect(item.getValue()).toEqual("hello");
      });

      it("item.setValue allows setting value when initial value is null", () => {
        const item = new MockStateItem<string | null>("intent", null);
        item.setValue("hello");
        expect(item.getValue()).toEqual("hello");
      });

      it("item.setValue enforces type after first set from undefined", () => {
        const item = new MockStateItem<any>("intent", undefined);
        item.setValue("hello");
        expect(() => item.setValue({} as any)).toThrowError("Invalid value type. Expected string, received object");
      });

      it("item.setValue works after resetValue when initial value is undefined", () => {
        const item = new MockStateItem<string | undefined>("intent", undefined);
        item.setValue("hello");
        expect(item.getValue()).toEqual("hello");
        item.resetValue();
        expect(item.getValue()).toBeUndefined();
        item.setValue("world");
        expect(item.getValue()).toEqual("world");
      });
})