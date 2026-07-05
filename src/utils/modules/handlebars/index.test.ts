import { hbs as hbsInstance } from "@/utils/modules/handlebars";


jest.mock('@/utils/modules/handlebars/helpers/async/async-helpers', () => ({
  asyncCoreOverrideHelpers: {
    asyncHelper1: jest.fn(),
    asyncHelper2: jest.fn(),
    if: jest.fn(),
  }
}));

describe("useHandlebars", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    process.env = { ...OLD_ENV }; // Make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  test("hbs", () => {
    expect(hbsInstance.handlebars).toHaveProperty("helpers");
    expect(hbsInstance.handlebars).toHaveProperty("partials");
    expect(hbsInstance.handlebars).toHaveProperty("VERSION");
    // Assert against the installed package so security bumps don't require
    // touching this test; the point is that hbs wraps real handlebars.
    expect(hbsInstance.handlebars.VERSION).toEqual(
      require("handlebars/package.json").version
    );
  });

});
