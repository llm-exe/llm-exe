import { replaceTemplateStringAsync } from "@/utils/modules/replaceTemplateStringAsync";
import { registerHelpers, registerPartials } from "@/utils/modules";

describe("replaceTemplateStringAsync", () => {
  it("replaceTemplateStringAsync replaces template", async () => {
    
    expect(replaceTemplateStringAsync("hello {{var}}", { var: "world" })).resolves.toBe(
      "hello world"
    );
  });
  it("replaceTemplateStringAsync returns if passed nothing", async () => {
    expect(replaceTemplateStringAsync(undefined as any, { var: "world" })).resolves.toBe(
      ""
    );
  });
  it("replaceTemplateStringAsync returns if passed nothing", async () => {
    expect(replaceTemplateStringAsync(null as any)).resolves.toBe("");
  });
  it("replaceTemplateStringAsync replaces template with custom helper", async () => {
    const helpers = [
      {
        handler: () => "from function",
        name: "helperFromConfig",
      },
    ];
    expect(
      replaceTemplateStringAsync("hello {{helperFromConfig}}", {}, { helpers })
    ).resolves.toBe("hello from function");
  });
  it("replaceTemplateStringAsync replaces template with custom partial", async () => {
    const partials = [
      {
        template: "from partial",
        name: "partialFromConfig",
      },
    ];
    expect(
      replaceTemplateStringAsync(
        "hello {{>partialFromConfig}}",
        {},
        { partials }
      )
    ).resolves.toBe("hello from partial");
  });
});

describe("replaceTemplateStringAsync noEscape (#961)", () => {
  const raw = `Tom & Jerry's "<b>code</b>" a < b`;
  it("HTML-escapes {{var}} by default (unchanged behavior)", async () => {
    await expect(replaceTemplateStringAsync("{{v}}", { v: raw })).resolves.toBe(
      "Tom &amp; Jerry&#x27;s &quot;&lt;b&gt;code&lt;/b&gt;&quot; a &lt; b"
    );
  });
  it("passes values through unchanged with noEscape: true", async () => {
    await expect(
      replaceTemplateStringAsync("{{v}}", { v: raw }, { noEscape: true })
    ).resolves.toBe(raw);
  });

  it("applies noEscape inside per-call partials and unregisters them after", async () => {
    await expect(
      replaceTemplateStringAsync(
        "{{> temp961}}{{tempHelper961 v}}",
        { v: raw },
        {
          noEscape: true,
          partials: [{ name: "temp961", template: "[{{v}}]" }],
          helpers: [{ name: "tempHelper961", handler: (s: string) => `<${s}>` }],
        }
      )
    ).resolves.toBe(`[${raw}]<${raw}>`);
    await expect(
      replaceTemplateStringAsync("{{> temp961}}", {}, { noEscape: true })
    ).rejects.toThrow(/temp961/);
    await expect(
      replaceTemplateStringAsync(
        "{{tempHelper961 v}}",
        { v: "x" },
        { noEscape: true }
      )
    ).rejects.toThrow(/tempHelper961/);
  });
});

// See the sync tests: the first render's escape mode must not stick to
// globally registered partials.
describe("replaceTemplateStringAsync noEscape with global partials and helpers (#961)", () => {
  const raw = `Tom & Jerry's "<b>code</b>" a < b`;
  const escaped =
    "Tom &amp; Jerry&#x27;s &quot;&lt;b&gt;code&lt;/b&gt;&quot; a &lt; b";

  it("a noEscape render first does not unescape a later default render", async () => {
    registerPartials([{ name: "global961a", template: "[{{v}}]" }]);
    await expect(
      replaceTemplateStringAsync(
        "{{> global961a}}",
        { v: raw },
        { noEscape: true }
      )
    ).resolves.toBe(`[${raw}]`);
    await expect(
      replaceTemplateStringAsync("{{> global961a}}", { v: raw })
    ).resolves.toBe(`[${escaped}]`);
  });

  it("a default render first does not escape a later noEscape render", async () => {
    registerPartials([{ name: "global961b", template: "[{{v}}]" }]);
    await expect(
      replaceTemplateStringAsync("{{> global961b}}", { v: raw })
    ).resolves.toBe(`[${escaped}]`);
    await expect(
      replaceTemplateStringAsync(
        "{{> global961b}}",
        { v: raw },
        { noEscape: true }
      )
    ).resolves.toBe(`[${raw}]`);
  });

  it("keeps the built-in partials separate per mode", async () => {
    const context = {
      attributes: { stepsTaken: [{ thought: "t", action: "a", result: raw }] },
    };
    const first = await replaceTemplateStringAsync(
      "{{> ThoughtActionResult}}",
      context
    );
    const unescaped = await replaceTemplateStringAsync(
      "{{> ThoughtActionResult}}",
      context,
      { noEscape: true }
    );
    expect(first).toContain(`Result: ${escaped}`);
    expect(unescaped).toContain(`Result: ${raw}`);
    await expect(
      replaceTemplateStringAsync("{{> ThoughtActionResult}}", context)
    ).resolves.toBe(first);
  });

  it("makes globally registered helpers available to noEscape renders", async () => {
    registerHelpers([
      { name: "globalHelper961", handler: (s: string) => `<${s}>` },
    ]);
    await expect(
      replaceTemplateStringAsync(
        "{{globalHelper961 v}}",
        { v: raw },
        { noEscape: true }
      )
    ).resolves.toBe(`<${raw}>`);
  });
});
