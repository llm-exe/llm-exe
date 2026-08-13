
import { BasePrompt } from "@/prompt";
import { PromptHelper, PromptOptions, PromptPartial } from "@/types";

/**
 * Tests the TextPrompt class
 */
describe("llm-exe:prompt/TextPrompt", () => {
    class MockPrompt<I extends Record<string, any>>  extends BasePrompt<I> {
        constructor(initialPromptMessage?: string, options?: PromptOptions){
            super(initialPromptMessage, options)
        }
    }

  it('creates class with expected properties', () => {
    const prompt = new MockPrompt()

    expect(prompt).toBeInstanceOf(BasePrompt)
    expect(prompt).toHaveProperty("type")
    expect(prompt.type).toEqual("text")

    expect(prompt).toHaveProperty("messages")
    expect(prompt.messages).toEqual([])

    expect(prompt).toHaveProperty("partials")
    expect(prompt.partials).toEqual([])

    expect(prompt).toHaveProperty("helpers")
    expect(prompt.helpers).toEqual([])

    expect(prompt).toHaveProperty("type")
    expect(prompt).toHaveProperty("addToPrompt")
    expect(prompt).toHaveProperty("addSystemMessage")
    expect(prompt).toHaveProperty("format")
    expect(prompt).toHaveProperty("formatAsync")

    
    expect(prompt).toHaveProperty("registerPartial")
    expect(prompt).toHaveProperty("registerHelpers")
    expect(prompt).toHaveProperty("validate")
  });
  test("PromptHelper", () => {
    const helpers: PromptHelper[] = [{
      name: "helper",
      handler: (_args: any) => "any",
    }];
    const textPrompt = new MockPrompt("", { helpers });
    expect(textPrompt.helpers[0]).toEqual(helpers[0]);
  });
  test("PromptPartial", () => {
    const partials: PromptPartial[] = [{
      name: "helper",
      template: "helper"
    }];
    const textPrompt = new MockPrompt("", { partials });
    expect(textPrompt.partials[0]).toEqual(partials[0]);
  });

  test("gets formatAsync", async () => {
    async function getSomethingAsync() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve("this is from another world");
        }, 200);
      });
    }

    const textPrompt = new MockPrompt("Hello {{getSomethingAsync}}", {});
    const formatted = await textPrompt.formatAsync({ getSomethingAsync });
    expect(formatted).toEqual("Hello this is from another world");
  });

  test("gets formatAsync", async () => {
    async function getObjectAsync() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
              value: "this is from another world"
          });
        }, 200);
      });
    }
  
    const textPrompt = new MockPrompt("Hello {{getObjectAsync.value}}", {});
    const formatted = await textPrompt.formatAsync({ cond: true, getObjectAsync,  });
    expect(formatted).toEqual("Hello this is from another world");
  });

  test("gets formatAsync from Promise", async () => {
    const textPrompt = new MockPrompt("Hello {{getObjectAsync.value}}", {});
    const formatted = await textPrompt.formatAsync({ cond: true, getObjectAsync: new Promise((resolve) => {
        setTimeout(() => {
          resolve({
              value: "this is from another world"
          });
        }, 200);
      })});
    expect(formatted).toEqual("Hello this is from another world");
  });



  test("gets formatAsync", async () => {
    async function getObjectAsync() {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
              value: "this is from another world"
          });
        }, 200);
      });
    }
  
    const textPrompt = new MockPrompt(undefined, {});

    textPrompt.messages = [{invalid: "message"}]as any
    const formatted = await textPrompt.formatAsync({ cond: true, getObjectAsync });
    expect(formatted).toEqual("");
  });

  describe("getReplacements", () => {
    test("throws prompt.missing_input when values is undefined", () => {
      const prompt = new MockPrompt("Hello {{name}}");
      expect(() => prompt.getReplacements(undefined as any)).toThrow(
        "format() requires an input object. Did you forget to pass arguments?"
      );
      try {
        prompt.getReplacements(undefined as any);
      } catch (error: any) {
        expect(error.code).toEqual("prompt.missing_input");
        expect(error.context.received).toEqual("undefined");
        expect(error.context.promptType).toEqual("text");
      }
    });

    test("throws prompt.missing_input when values is null, reporting 'null'", () => {
      const prompt = new MockPrompt("Hello {{name}}");
      try {
        prompt.getReplacements(null as any);
        throw new Error("should have thrown");
      } catch (error: any) {
        expect(error.code).toEqual("prompt.missing_input");
        expect(error.context.received).toEqual("null");
      }
    });

    test("defaults input to empty string and mirrors it to _input", () => {
      const prompt = new MockPrompt();
      expect(prompt.getReplacements({ a: 1 } as any)).toEqual({
        a: 1,
        input: "",
        _input: "",
      });
    });

    test("preserves a provided input value on both input and _input", () => {
      const prompt = new MockPrompt();
      expect(prompt.getReplacements({ input: "abc", b: 2 } as any)).toEqual({
        b: 2,
        input: "abc",
        _input: "abc",
      });
    });
  });

  describe("filters", () => {
    test("runs pre filters before replacement and post filters after", () => {
      const prompt = new MockPrompt("hello {{name}}", {
        preFilters: [(p: string) => p.toUpperCase().replace("{{NAME}}", "{{name}}")],
        postFilters: [(p: string) => `<${p}>`],
      });
      expect(prompt.format({ name: "world" } as any)).toEqual("<HELLO world>");
    });

    test("applies multiple filters in registration order", () => {
      const prompt = new MockPrompt("x", {
        postFilters: [(p: string) => `${p}-1`, (p: string) => `${p}-2`],
      });
      expect(prompt.format({} as any)).toEqual("x-1-2");
    });

    test("passes the format values through to filters", () => {
      const seen: any[] = [];
      const prompt = new MockPrompt("x", {
        postFilters: [
          ((p: string, values: any) => {
            seen.push(values);
            return p;
          }) as any,
        ],
      });
      prompt.format({ name: "world" } as any);
      expect(seen).toEqual([{ name: "world" }]);
    });

    test("ignores non-array preFilters/postFilters options", () => {
      const prompt = new MockPrompt("x", {
        preFilters: "nope" as any,
        postFilters: "nope" as any,
      });
      expect(prompt.filters.pre).toEqual([]);
      expect(prompt.filters.post).toEqual([]);
      expect(prompt.format({} as any)).toEqual("x");
    });
  });

  describe("validateInput", () => {
    test("defaults to false and does not throw on missing variables", () => {
      const prompt = new MockPrompt("Hello {{missing}}");
      expect(prompt.validateInput).toEqual(false);
      expect(() => prompt.format({} as any)).not.toThrow();
    });

    test("throws prompt.missing_template_variable in 'strict' mode", () => {
      const prompt = new MockPrompt("Hello {{missing}}", {
        validateInput: "strict",
      });
      try {
        prompt.format({} as any);
        throw new Error("should have thrown");
      } catch (error: any) {
        expect(error.code).toEqual("prompt.missing_template_variable");
        expect(error.context.missingVariables).toContain("missing");
      }
    });

    test("emits a process warning instead of throwing when set to 'warn'", () => {
      const emitWarning = jest
        .spyOn(process, "emitWarning")
        .mockImplementation(() => undefined);
      const prompt = new MockPrompt("Hello {{missing}}", {
        validateInput: "warn",
      });

      expect(() => prompt.format({} as any)).not.toThrow();
      expect(emitWarning).toHaveBeenCalledTimes(1);
      expect((emitWarning.mock.calls[0][0] as any).code).toEqual(
        "prompt.missing_template_variable"
      );
      emitWarning.mockRestore();
    });

    test("does not warn when all referenced variables are provided", () => {
      const emitWarning = jest
        .spyOn(process, "emitWarning")
        .mockImplementation(() => undefined);
      const prompt = new MockPrompt("Hello {{name}}", {
        validateInput: "warn",
      });

      expect(prompt.format({ name: "world" } as any)).toEqual("Hello world");
      expect(emitWarning).not.toHaveBeenCalled();
      emitWarning.mockRestore();
    });

    test("rethrows non-missing-variable errors even in 'warn' mode", () => {
      const prompt = new MockPrompt("Hello {{name}}", {
        validateInput: "warn",
      });
      const boom = new Error("unrelated failure");
      jest.spyOn(prompt, "validate").mockImplementation(() => {
        throw boom;
      });

      expect(() => prompt.format({ name: "world" } as any)).toThrow(
        "unrelated failure"
      );
    });

    test("validates on formatAsync as well", async () => {
      const prompt = new MockPrompt("Hello {{missing}}", {
        validateInput: "strict",
      });
      await expect(prompt.formatAsync({} as any)).rejects.toThrow();
    });
  });

  describe("validate", () => {
    test("reports unregistered helpers as missing", () => {
      const prompt = new MockPrompt("{{myHelper name}}");
      try {
        prompt.validate({ name: "world" } as any);
        throw new Error("should have thrown");
      } catch (error: any) {
        expect(error.code).toEqual("prompt.missing_template_variable");
        expect(error.context.missingHelpers).toContain("myHelper");
      }
    });

    test("accepts a helper once registered", () => {
      const prompt = new MockPrompt("{{myHelper name}}");
      prompt.registerHelpers({
        name: "myHelper",
        handler: (v: string) => v,
      } as PromptHelper);
      expect(() => prompt.validate({ name: "world" } as any)).not.toThrow();
    });

    test("dedupes the same missing variable across multiple messages", () => {
      const prompt = new MockPrompt("{{missing}}");
      prompt.addSystemMessage("{{missing}} again");
      try {
        prompt.validate({} as any);
        throw new Error("should have thrown");
      } catch (error: any) {
        expect(error.context.missingVariables).toEqual(["missing"]);
      }
    });

    test("returns void when nothing is missing", () => {
      const prompt = new MockPrompt("Hello {{name}}");
      expect(prompt.validate({ name: "world" } as any)).toBeUndefined();
    });

    test("skips messages whose content is an array", () => {
      const prompt = new MockPrompt();
      prompt.messages = [
        { role: "system", content: [{ type: "text", text: "{{missing}}" }] },
      ] as any;
      expect(() => prompt.validate({} as any)).not.toThrow();
    });
  });

  describe("message construction", () => {
    test("ignores an empty initial prompt message", () => {
      expect(new MockPrompt("").messages).toEqual([]);
      expect(new MockPrompt(undefined).messages).toEqual([]);
    });

    test("addToPrompt routes unknown roles to system", () => {
      const prompt = new MockPrompt();
      prompt.addToPrompt("hello", "some-unknown-role");
      expect(prompt.messages).toEqual([{ role: "system", content: "hello" }]);
    });

    test("addToPrompt ignores empty content", () => {
      const prompt = new MockPrompt();
      prompt.addToPrompt("");
      expect(prompt.messages).toEqual([]);
    });

    test("addToPrompt and addSystemMessage are chainable", () => {
      const prompt = new MockPrompt();
      expect(prompt.addToPrompt("a")).toBe(prompt);
      expect(prompt.addSystemMessage("b")).toBe(prompt);
      expect(prompt.messages).toHaveLength(2);
    });

    test("joins multiple messages with the default separator", () => {
      const prompt = new MockPrompt("one");
      prompt.addSystemMessage("two");
      expect(prompt.format({} as any)).toEqual("one\n\ntwo");
    });

    test("honors a custom separator", async () => {
      const prompt = new MockPrompt("one");
      prompt.addSystemMessage("two");
      expect(prompt.format({} as any, " | ")).toEqual("one | two");
      await expect(prompt.formatAsync({} as any, " | ")).resolves.toEqual(
        "one | two"
      );
    });
  });

  describe("registration", () => {
    test("registerPartial accepts a single partial or an array", () => {
      const one: PromptPartial = { name: "a", template: "A" };
      const two: PromptPartial = { name: "b", template: "B" };
      const prompt = new MockPrompt();
      prompt.registerPartial(one);
      prompt.registerPartial([two]);
      expect(prompt.partials).toEqual([one, two]);
    });

    test("registerHelpers accepts a single helper or an array", () => {
      const one = { name: "a", handler: () => "A" } as PromptHelper;
      const two = { name: "b", handler: () => "B" } as PromptHelper;
      const prompt = new MockPrompt();
      prompt.registerHelpers(one);
      prompt.registerHelpers([two]);
      expect(prompt.helpers).toEqual([one, two]);
    });

    test("registration methods are chainable", () => {
      const prompt = new MockPrompt();
      expect(
        prompt.registerPartial({ name: "a", template: "A" })
      ).toBe(prompt);
      expect(
        prompt.registerHelpers({ name: "b", handler: () => "B" } as PromptHelper)
      ).toBe(prompt);
    });

    test("uses a custom replaceTemplateString when provided", () => {
      const custom = jest.fn().mockReturnValue("replaced");
      const prompt = new MockPrompt("hello {{name}}", {
        replaceTemplateString: custom as any,
      });
      expect(prompt.format({ name: "world" } as any)).toEqual("replaced");
      expect(custom).toHaveBeenCalled();
    });
  });
})