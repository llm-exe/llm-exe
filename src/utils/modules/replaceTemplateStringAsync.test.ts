import { replaceTemplateStringAsync } from "@/utils/modules/replaceTemplateStringAsync";

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
});
