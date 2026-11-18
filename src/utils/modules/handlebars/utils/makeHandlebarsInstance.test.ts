import Handlebars from "handlebars";
import { makeHandlebarsInstance } from "./makeHandlebarsInstance";
import { _registerPartials } from "@/utils/modules/handlebars/utils/registerPartials";
// import { registerHelpers } from "@/utils/modules/handlebars/utils/registerHelpers";
import { getEnvironmentVariable } from "@/utils/modules/getEnvironmentVariable";
import * as contextPartials from "@/utils/modules/handlebars/templates";
// import * as helpers from "@/utils/modules/handlebars/helpers";

jest.mock("@/utils/modules/handlebars/utils/registerPartials");
// jest.mock("@/utils/modules/handlebars/utils/registerHelpers");
jest.mock("@/utils/modules/getEnvironmentVariable");
jest.mock("@/utils/modules/handlebars/templates");
jest.mock("@/utils/modules/handlebars/helpers");

describe("makeHandlebarsInstance", () => {
  let handlebarsInstance = makeHandlebarsInstance(Handlebars);
  // ReturnType<typeof makeHandlebarsInstance>;

  beforeEach(() => {
    (getEnvironmentVariable as jest.Mock).mockReturnValue(undefined);
    // handlebarsInstance = makeHandlebarsInstance(Handlebars);
  });

  it("should create a new Handlebars instance", () => {
    expect(handlebarsInstance).toBeDefined();
  });

  it("should register 'with' helper", () => {
    expect(handlebarsInstance.helpers.with).toBeDefined();
  });

  it("should register 'cut' helper", () => {
    expect(handlebarsInstance.helpers.cut).toBeDefined();
  });

  it("should register 'substring' helper", () => {
    expect(handlebarsInstance.helpers.substring).toBeDefined();
  });

  it("should register 'unless' helper", () => {
    expect(handlebarsInstance.helpers.unless).toBeDefined();
  });

  it("should register 'hbsInTemplate' helper", () => {
    expect(handlebarsInstance.helpers.hbsInTemplate).toBeDefined();
  });

  it("should register 'hbsInTemplate' helper", () => {
    expect(
      handlebarsInstance.helpers.hbsInTemplate.call(null, "Hello {{world}}!", {
        world: "World",
      })
    ).toBeDefined();
  });

  it("compiles every template with noEscape when created with { noEscape: true }", () => {
    const raw = `a & b's <c>`;
    const noEscape = makeHandlebarsInstance(Handlebars, { noEscape: true });
    expect(noEscape.compile("{{v}}")({ v: raw })).toBe(raw);
    expect(makeHandlebarsInstance(Handlebars).compile("{{v}}")({ v: raw })).toBe(
      "a &amp; b&#x27;s &lt;c&gt;"
    );
  });

  it("should register context partials", () => {
    (contextPartials as any).partials = { partial1: "<div>Partial 1</div>" };
    handlebarsInstance = makeHandlebarsInstance(Handlebars);

    expect(handlebarsInstance.partials.partial1).toBeDefined();
  });
});
