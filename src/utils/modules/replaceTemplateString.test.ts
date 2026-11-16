import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";

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
});
