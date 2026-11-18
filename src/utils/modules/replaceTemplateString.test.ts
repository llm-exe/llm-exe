import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";
import { registerHelpers, registerPartials } from "@/utils/modules";

describe("replaceTemplateString", () => {
  it("replaceTemplateString replaces template", async () => {
    expect(replaceTemplateString("hello {{var}}", { var: "world" })).toBe(
      "hello world"
    );
  });
  it("replaceTemplateString returns if passed nothing", async () => {
    expect(replaceTemplateString(undefined as any, { var: "world" })).toBe("");
  });
  it("replaceTemplateString returns if passed nothing", async () => {
    expect(replaceTemplateString(null as any)).toBe("");
  });
  it("replaceTemplateString replaces template with custom helper", async () => {
    const helpers = [
      {
        handler: () => "from function",
        name: "helperFromConfig",
      },
    ];
    expect(
      replaceTemplateString("hello {{helperFromConfig}}", {}, { helpers })
    ).toBe("hello from function");
  });
  it("replaceTemplateString renders {{#with}} block on the sync path", () => {
    expect(
      replaceTemplateString("{{#with u}}{{email}}{{/with}}", {
        u: { email: "a@b.c" },
      })
    ).toBe("a@b.c");
  });
  it("replaceTemplateString renders other block helpers on the sync path", () => {
    expect(
      replaceTemplateString("{{#if active}}on{{/if}}", { active: true })
    ).toBe("on");
    expect(
      replaceTemplateString("{{#each items}}{{this}}{{/each}}", {
        items: ["a", "b"],
      })
    ).toBe("ab");
    expect(
      replaceTemplateString("{{#unless active}}off{{/unless}}", {
        active: false,
      })
    ).toBe("off");
  });
  it("replaceTemplateString replaces template with custom partial", async () => {
    const partials = [
      {
        template: "from partial",
        name: "partialFromConfig",
      },
    ];
    expect(
      replaceTemplateString("hello {{>partialFromConfig}}", {}, { partials })
    ).toBe("hello from partial");
  });
});

describe("replaceTemplateString noEscape (#961)", () => {
  const raw = `Tom & Jerry's "<b>code</b>" a < b`;
  it("HTML-escapes {{var}} by default (unchanged behavior)", () => {
    expect(replaceTemplateString("{{v}}", { v: raw })).toBe(
      "Tom &amp; Jerry&#x27;s &quot;&lt;b&gt;code&lt;/b&gt;&quot; a &lt; b"
    );
  });
  it("passes values through unchanged with noEscape: true", () => {
    expect(replaceTemplateString("{{v}}", { v: raw }, { noEscape: true })).toBe(raw);
  });
  it("applies noEscape inside partials", () => {
    expect(
      replaceTemplateString(
        "{{> p961}}",
        { v: raw },
        { noEscape: true, partials: [{ name: "p961", template: "[{{v}}]" }] }
      )
    ).toBe(`[${raw}]`);
  });

  it("unregisters per-call partials and helpers after a noEscape render", () => {
    expect(
      replaceTemplateString(
        "{{> temp961}}{{tempHelper961 v}}",
        { v: raw },
        {
          noEscape: true,
          partials: [{ name: "temp961", template: "[{{v}}]" }],
          helpers: [{ name: "tempHelper961", handler: (s: string) => `<${s}>` }],
        }
      )
    ).toBe(`[${raw}]<${raw}>`);
    expect(() =>
      replaceTemplateString("{{> temp961}}", {}, { noEscape: true })
    ).toThrow(/temp961/);
    expect(() =>
      replaceTemplateString("{{tempHelper961 v}}", { v: "x" }, { noEscape: true })
    ).toThrow(/tempHelper961/);
  });

  it("applies noEscape inside hbsInTemplate", () => {
    expect(
      replaceTemplateString(
        "{{hbsInTemplate tpl this}}",
        { tpl: "{{v}}", v: raw },
        { noEscape: true }
      )
    ).toBe(raw);
  });
});

// Handlebars compiles a string partial the first time a template uses it, with
// that template's compile options, and caches the result. These check that the
// first render's escape mode doesn't stick to globally registered partials.
describe("replaceTemplateString noEscape with global partials and helpers (#961)", () => {
  const raw = `Tom & Jerry's "<b>code</b>" a < b`;
  const escaped =
    "Tom &amp; Jerry&#x27;s &quot;&lt;b&gt;code&lt;/b&gt;&quot; a &lt; b";

  it("a noEscape render first does not unescape a later default render", () => {
    registerPartials([{ name: "global961a", template: "[{{v}}]" }]);
    expect(
      replaceTemplateString("{{> global961a}}", { v: raw }, { noEscape: true })
    ).toBe(`[${raw}]`);
    expect(replaceTemplateString("{{> global961a}}", { v: raw })).toBe(
      `[${escaped}]`
    );
  });

  it("a default render first does not escape a later noEscape render", () => {
    registerPartials([{ name: "global961b", template: "[{{v}}]" }]);
    expect(replaceTemplateString("{{> global961b}}", { v: raw })).toBe(
      `[${escaped}]`
    );
    expect(
      replaceTemplateString("{{> global961b}}", { v: raw }, { noEscape: true })
    ).toBe(`[${raw}]`);
  });

  it("keeps the built-in partials separate per mode", () => {
    const context = {
      attributes: { stepsTaken: [{ thought: "t", action: "a", result: raw }] },
    };
    const first = replaceTemplateString("{{> ThoughtActionResult}}", context);
    const unescaped = replaceTemplateString(
      "{{> ThoughtActionResult}}",
      context,
      { noEscape: true }
    );
    expect(first).toContain(`Result: ${escaped}`);
    expect(unescaped).toContain(`Result: ${raw}`);
    expect(replaceTemplateString("{{> ThoughtActionResult}}", context)).toBe(
      first
    );
  });

  it("makes globally registered helpers available to noEscape renders", () => {
    registerHelpers([
      { name: "globalHelper961", handler: (s: string) => `<${s}>` },
    ]);
    expect(
      replaceTemplateString("{{globalHelper961 v}}", { v: raw }, { noEscape: true })
    ).toBe(`<${raw}>`);
    expect(replaceTemplateString("{{globalHelper961 v}}", { v: raw })).toBe(
      `&lt;${escaped}&gt;`
    );
  });
});
