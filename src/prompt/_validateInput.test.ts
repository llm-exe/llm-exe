import { ChatPrompt, TextPrompt } from "@/prompt";
import { isLlmExeError } from "@/errors";

describe("Prompt.validate(input) (v3)", () => {
  describe("TextPrompt", () => {
    it("returns void when all variables are present", () => {
      const prompt = new TextPrompt("Hello {{name}}, age {{age}}");
      expect(() =>
        prompt.validate({ name: "Greg", age: 38 })
      ).not.toThrow();
    });

    it("throws LlmExeError(prompt.missing_template_variable) when missing", () => {
      const prompt = new TextPrompt("Hello {{name}}, age {{age}}");
      let caught: unknown;
      try {
        prompt.validate({ name: "Greg" } as any);
      } catch (e) {
        caught = e;
      }
      expect(
        isLlmExeError(caught, "prompt.missing_template_variable")
      ).toBe(true);
    });

    it("reports all missing variables, not just the first", () => {
      const prompt = new TextPrompt("Hello {{a}} {{b}} {{c}}");
      let caught: any;
      try {
        prompt.validate({} as any);
      } catch (e) {
        caught = e;
      }
      expect(caught.context.missingVariables.sort()).toEqual(["a", "b", "c"]);
    });

    it("treats null/false/0/'' as present", () => {
      const prompt = new TextPrompt("{{a}} {{b}} {{c}} {{d}}");
      expect(() =>
        prompt.validate({ a: 0, b: false, c: "", d: null } as any)
      ).not.toThrow();
    });

    it("does not execute helpers during validation", () => {
      const sideEffect = jest.fn(() => "rendered");
      const prompt = new TextPrompt("Hello {{name}} {{spy}}", {
        helpers: [{ name: "spy", handler: sideEffect }],
      });
      prompt.validate({ name: "Greg" });
      expect(sideEffect).not.toHaveBeenCalled();
    });

    it("does not require block-param aliases", () => {
      const prompt = new TextPrompt(
        "{{#each users as |user|}}{{user.name}}{{/each}}"
      );
      expect(() => prompt.validate({ users: [] } as any)).not.toThrow();
    });

    it("reports unregistered helpers", () => {
      const prompt = new TextPrompt("Hello {{notAHelper x}}");
      let caught: any;
      try {
        prompt.validate({ x: "y" } as any);
      } catch (e) {
        caught = e;
      }
      expect(caught.context.missingHelpers).toEqual(["notAHelper"]);
    });
  });

  describe("ChatPrompt", () => {
    it("validates across multiple messages", () => {
      const prompt = new ChatPrompt("System {{a}}");
      prompt.addUserMessage("User {{b}}");
      prompt.addAssistantMessage("Assistant {{c}}");
      let caught: any;
      try {
        prompt.validate({ a: 1 } as any);
      } catch (e) {
        caught = e;
      }
      expect(caught.context.missingVariables.sort()).toEqual(["b", "c"]);
    });

    it("passes when all messages have their variables", () => {
      const prompt = new ChatPrompt("System {{a}}");
      prompt.addUserMessage("User {{b}}");
      expect(() => prompt.validate({ a: 1, b: 2 } as any)).not.toThrow();
    });
  });

  describe("validateInput option on format()", () => {
    it("default mode: format does not throw on missing variables", () => {
      const prompt = new TextPrompt("Hello {{name}}");
      expect(() => prompt.format({} as any)).not.toThrow();
    });

    it("strict mode: format throws before rendering", () => {
      const prompt = new TextPrompt("Hello {{name}}", {
        validateInput: "strict",
      });
      let caught: unknown;
      try {
        prompt.format({} as any);
      } catch (e) {
        caught = e;
      }
      expect(
        isLlmExeError(caught, "prompt.missing_template_variable")
      ).toBe(true);
    });

    it("strict mode: format returns normally when valid", () => {
      const prompt = new TextPrompt("Hello {{name}}", {
        validateInput: "strict",
      });
      expect(prompt.format({ name: "Greg" })).toBe("Hello Greg");
    });

    it("warn mode: emits process.emitWarning and continues rendering", () => {
      const warnSpy = jest
        .spyOn(process, "emitWarning")
        .mockImplementation();
      try {
        const prompt = new TextPrompt("Hello {{name}}", {
          validateInput: "warn",
        });
        const result = prompt.format({} as any);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const emitted = warnSpy.mock.calls[0][0] as any;
        expect(emitted.code).toBe("prompt.missing_template_variable");
        expect(result).toBe("Hello ");
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("warn mode: does not emit when valid", () => {
      const warnSpy = jest
        .spyOn(process, "emitWarning")
        .mockImplementation();
      try {
        const prompt = new TextPrompt("Hello {{name}}", {
          validateInput: "warn",
        });
        prompt.format({ name: "Greg" });
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("warn mode: silently no-ops in non-Node runtime (process.emitWarning absent)", () => {
      const original = process.emitWarning;
      // @ts-expect-error simulating a runtime without process.emitWarning
      delete process.emitWarning;
      try {
        const prompt = new TextPrompt("Hello {{name}}", {
          validateInput: "warn",
        });
        expect(() => prompt.format({} as any)).not.toThrow();
      } finally {
        process.emitWarning = original;
      }
    });

    it("strict mode on ChatPrompt throws before any message is rendered", () => {
      const prompt = new ChatPrompt("Hello {{a}}", {
        validateInput: "strict",
      });
      prompt.addUserMessage("User {{b}}");
      let caught: any;
      try {
        prompt.format({ a: 1 } as any);
      } catch (e) {
        caught = e;
      }
      expect(
        isLlmExeError(caught, "prompt.missing_template_variable")
      ).toBe(true);
      expect(caught.context.missingVariables).toEqual(["b"]);
    });
  });

  describe("async preflight", () => {
    it("strict mode: formatAsync rejects on missing variables", async () => {
      const prompt = new TextPrompt("Hello {{name}}", {
        validateInput: "strict",
      });
      await expect(prompt.formatAsync({} as any)).rejects.toMatchObject({
        code: "prompt.missing_template_variable",
      });
    });

    it("strict mode: ChatPrompt formatAsync rejects on missing variables", async () => {
      const prompt = new ChatPrompt("System {{a}}", {
        validateInput: "strict",
      });
      prompt.addUserMessage("User {{b}}");
      await expect(prompt.formatAsync({ a: 1 } as any)).rejects.toMatchObject({
        code: "prompt.missing_template_variable",
      });
    });

    it("warn mode: formatAsync emits and continues", async () => {
      const warnSpy = jest
        .spyOn(process, "emitWarning")
        .mockImplementation();
      try {
        const prompt = new TextPrompt("Hello {{name}}", {
          validateInput: "warn",
        });
        const result = await prompt.formatAsync({} as any);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(result).toBe("Hello ");
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe("error message", () => {
    it("reports both missing variables and helpers in a single error", () => {
      const prompt = new TextPrompt("{{name}} {{unknownHelper x}}");
      let caught: any;
      try {
        prompt.validate({} as any);
      } catch (e) {
        caught = e;
      }
      expect(caught.message).toMatch(/Missing variables: /);
      expect(caught.message).toMatch(/Missing helpers: /);
      expect(caught.context.missingVariables.sort()).toEqual(["name", "x"]);
      expect(caught.context.missingHelpers).toEqual(["unknownHelper"]);
    });
  });

  describe("ChatPrompt with array content", () => {
    it("skips array-content messages in validation (initial v3 scope)", () => {
      const prompt = new ChatPrompt("System {{a}}");
      // Manually push a message with array content (e.g. a multimodal-style block).
      prompt.messages.push({
        role: "user",
        content: [{ type: "text", text: "User {{b}}" }],
      } as any);
      // Only the string-content system message is validated; array content is
      // not walked in this initial scope, so `b` is not reported missing.
      let caught: any;
      try {
        prompt.validate({} as any);
      } catch (e) {
        caught = e;
      }
      expect(caught.context.missingVariables).toEqual(["a"]);
    });

    it("skips messages with empty content", () => {
      const prompt = new ChatPrompt("System {{a}}");
      prompt.messages.push({ role: "user", content: "" } as any);
      expect(() => prompt.validate({ a: 1 } as any)).not.toThrow();
    });
  });

  describe("regression: helpers with side effects", () => {
    it("does not call registered helpers during validate()", () => {
      const sideEffect = jest.fn(() => "rendered");
      const prompt = new TextPrompt("{{sideEffect input}}", {
        helpers: [{ name: "sideEffect", handler: sideEffect }],
      });
      prompt.validate({ input: "ok" });
      expect(sideEffect).not.toHaveBeenCalled();
    });

    it("still detects missing variables inside helper params", () => {
      const prompt = new TextPrompt("{{formatDate missingThing}}", {
        helpers: [{ name: "formatDate", handler: () => "" }],
      });
      let caught: any;
      try {
        prompt.validate({} as any);
      } catch (e) {
        caught = e;
      }
      expect(caught.context.missingVariables).toEqual(["missingThing"]);
    });
  });
});
