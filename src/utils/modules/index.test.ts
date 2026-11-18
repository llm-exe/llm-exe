import * as utils from "./index"
import { hbs, hbsAsync, hbsAsyncNoEscape, hbsNoEscape } from "./handlebars";

jest.mock("./handlebars", () => ({
  hbs: {
    registerHelpers: jest.fn(),
    registerPartials: jest.fn(),
  },
  hbsAsync: {
    registerHelpers: jest.fn(),
    registerPartials: jest.fn(),
  },
  hbsNoEscape: {
    registerHelpers: jest.fn(),
    registerPartials: jest.fn(),
  },
  hbsAsyncNoEscape: {
    registerHelpers: jest.fn(),
    registerPartials: jest.fn(),
  },
}));

describe("exports correct utils", () => {
  it("exports correct utils", async () => {
    expect(typeof utils.asyncCallWithTimeout).toBe("function");
    expect(typeof utils.assert).toBe("function");
    expect(typeof utils.defineSchema).toBe("function");
    expect(typeof utils.filterObjectOnSchema).toBe("function");
    expect(typeof utils.importHelpers).toBe("function");
    expect(typeof utils.importPartials).toBe("function");
    expect(typeof utils.maybeParseJSON).toBe("function");
    expect(typeof utils.maybeStringifyJSON).toBe("function");
    expect(typeof utils.replaceTemplateString).toBe("function");
    expect(typeof utils.replaceTemplateStringAsync).toBe("function")
    expect(typeof utils.escapeTemplateString).toBe("function");
    expect(typeof utils.registerHelpers).toBe("function");
    expect(typeof utils.registerPartials).toBe("function");
    expect(typeof utils.isObjectStringified).toBe("function");
    expect(typeof utils.guessProviderFromModel).toBe("function");
  });

  describe("registerHelpers", () => {
    it("registers on every instance, including the noEscape ones", () => {
      const helpers = [{ name: "test", fn: () => {} }];
      utils.registerHelpers(helpers);

      for (const instance of [hbs, hbsAsync, hbsNoEscape, hbsAsyncNoEscape]) {
        expect(instance.registerHelpers).toHaveBeenCalledWith(helpers);
      }
    });
  });

  describe("registerPartials", () => {
    it("registers on every instance, including the noEscape ones", () => {
      const partials = [{ name: "test", template: "{{test}}" }];
      utils.registerPartials(partials);

      for (const instance of [hbs, hbsAsync, hbsNoEscape, hbsAsyncNoEscape]) {
        expect(instance.registerPartials).toHaveBeenCalledWith(partials);
      }
    });
  });
})