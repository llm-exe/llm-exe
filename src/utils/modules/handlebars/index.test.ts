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
    expect(hbsInstance.handlebars.VERSION).toEqual("4.7.9");
  });

});
