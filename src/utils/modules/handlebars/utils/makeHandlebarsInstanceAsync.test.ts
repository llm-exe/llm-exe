import Handlebars from "handlebars";
import {
  makeHandlebarsInstanceAsync,
  HandlebarsAsync,
} from "@/utils/modules/handlebars/utils/makeHandlebarsInstanceAsync";

/**
 * These tests exercise the async Handlebars instance end-to-end. The whole
 * point of this instance is that helpers may return Promises and still render
 * correctly, so we drive the promise-aware code paths (escapeExpression and
 * lookupProperty) through real templates rather than mocking internals.
 */
describe("makeHandlebarsInstanceAsync", () => {
  let hbs: HandlebarsAsync;

  beforeEach(() => {
    hbs = makeHandlebarsInstanceAsync(Handlebars);
  });

  it("returns a fresh, isolated instance (not the global Handlebars)", () => {
    expect(hbs).not.toBe(Handlebars);
    expect(typeof hbs.compile).toBe("function");
  });

  it("compile returns a function that resolves to a Promise<string>", async () => {
    const template = hbs.compile("hello {{name}}");
    const result = template({ name: "world" }) as unknown as Promise<string>;
    expect(typeof (result as any).then).toBe("function");
    await expect(result).resolves.toBe("hello world");
  });

  it("renders plain interpolation", async () => {
    const template = hbs.compile("{{a}}-{{b}}");
    await expect(template({ a: "1", b: "2" })).resolves.toBe("1-2");
  });

  it("defaults missing context to an empty object", async () => {
    const template = hbs.compile("hello {{name}}");
    // context omitted entirely -> should not throw, renders empty var
    await expect(template(undefined as any)).resolves.toBe("hello ");
  });

  it("awaits an async helper that returns a Promise", async () => {
    hbs.registerHelper("asyncUpper", (value: string) =>
      Promise.resolve(String(value).toUpperCase())
    );
    const template = hbs.compile("value: {{asyncUpper name}}");
    await expect(template({ name: "abc" })).resolves.toBe("value: ABC");
  });

  it("escapes the resolved value of an async helper (escapeExpression promise path)", async () => {
    hbs.registerHelper("asyncHtml", () => Promise.resolve("<b>&</b>"));
    const template = hbs.compile("{{asyncHtml}}");
    await expect(template({})).resolves.toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("does not escape triple-stache async helper output", async () => {
    hbs.registerHelper("asyncHtml", () => Promise.resolve("<b>x</b>"));
    const template = hbs.compile("{{{asyncHtml}}}");
    await expect(template({})).resolves.toBe("<b>x</b>");
  });

  it("resolves property lookups on a Promise-returning helper (lookupProperty promise path)", async () => {
    hbs.registerHelper("asyncObj", () =>
      Promise.resolve({ inner: "deep-value" })
    );
    const template = hbs.compile("{{#with (asyncObj)}}{{inner}}{{/with}}");
    await expect(template({})).resolves.toBe("deep-value");
  });

  it("supports async helpers inside an #each block", async () => {
    hbs.registerHelper("asyncTag", (v: string) =>
      Promise.resolve(`[${v}]`)
    );
    const template = hbs.compile("{{#each items}}{{asyncTag this}}{{/each}}");
    await expect(template({ items: ["a", "b", "c"] })).resolves.toBe(
      "[a][b][c]"
    );
  });

  it("resolves multiple async helpers in one template", async () => {
    hbs.registerHelper("d", (v: number) =>
      Promise.resolve(String(v * 2))
    );
    const template = hbs.compile("{{d x}} and {{d y}}");
    await expect(template({ x: 2, y: 5 })).resolves.toBe("4 and 10");
  });
});
