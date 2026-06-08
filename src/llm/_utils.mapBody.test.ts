import { mapBody } from "@/llm/_utils.mapBody";
import { Config } from "@/types";

describe("mapBody", () => {
  beforeEach(() => {});

  it("should return an empty object if template is empty", () => {
    const template: Config["mapBody"] = {};
    const body: Record<string, any> = {};

    const result = mapBody(template, body);

    expect(result).toEqual({});
  });

  it("should map body keys based on the template", () => {
    const template: Config["mapBody"] = {
      name: { key: "userName" },
      age: { key: "userAge", default: 18 },
    };
    const body: Record<string, any> = {
      name: "John",
    };

    const result = mapBody(template, body);

    expect(result).toHaveProperty("userName");
    expect(result.userName).toEqual("John");

    expect(result).toHaveProperty("userAge");
    expect(result.userAge).toEqual(18);
  });

  it("should transform the value if transform function is provided", () => {
    const transformFn = jest.fn().mockReturnValue("SANITIZED");
    const template: Config["mapBody"] = {
      password: { key: "securePassword", transform: transformFn },
    };
    const body: Record<string, any> = {
      password: "untransformed_password",
    };

    const result = mapBody(template, body);

    expect(result).toHaveProperty("securePassword");
    expect(result.securePassword).toEqual("SANITIZED");
    expect(transformFn).toHaveBeenCalledWith(body.password, body, {
      securePassword: "SANITIZED",
    });
  });

  it("should not map if providerSpecificKey is not present in template", () => {
    const template: Config["mapBody"] = {
      name: { default: "NoNameProvided" }, // No key provided
    } as any;
    const body: Record<string, any> = {
      name: "John",
    };

    const result = mapBody(template, body);
    expect(result).toEqual({});
  });

  it("should use default value if body value is undefined", () => {
    const template: Config["mapBody"] = {
      name: { key: "userName", default: "DefaultName" },
    };
    const body: Record<string, any> = {}; // name is missing in body

    const result = mapBody(template, body);
    expect(result.userName).toEqual(template.name.default);
  });

  it("should not map key if value is undefined and no default is provided", () => {
    const template: Config["mapBody"] = {
      name: { key: "userName" },
    };
    const body: Record<string, any> = {};

    const result = mapBody(template, body);

    expect(result).toEqual({});
  });

  it("should fall back to default when transform returns undefined", () => {
    const template: Config["mapBody"] = {
      name: {
        key: "userName",
        default: "fallback",
        transform: () => undefined,
      },
    };
    const body: Record<string, any> = { name: "ignored" };

    const result = mapBody(template, body);

    expect(result.userName).toEqual("fallback");
  });

  it("should omit key when transform returns undefined and no default exists", () => {
    const template: Config["mapBody"] = {
      name: {
        key: "userName",
        transform: () => undefined,
      },
    };
    const body: Record<string, any> = { name: "present" };

    const result = mapBody(template, body);

    expect(result).toEqual({});
  });

  it("should pass a frozen copy of body to the transform function", () => {
    let receivedBody: Record<string, any> | undefined;
    const template: Config["mapBody"] = {
      name: {
        key: "userName",
        transform: (value, body) => {
          receivedBody = body;
          return value;
        },
      },
    };
    const body: Record<string, any> = { name: "John" };

    mapBody(template, body);

    expect(receivedBody).toBeDefined();
    expect(Object.isFrozen(receivedBody)).toBe(true);
    expect(() => {
      (receivedBody as any).name = "mutated";
    }).toThrow();
  });

  it("should pass accumulated output to subsequent transforms", () => {
    const seenOutputs: Array<Record<string, any>> = [];
    const template: Config["mapBody"] = {
      first: {
        key: "firstKey",
        transform: (value, _body, output) => {
          seenOutputs.push({ ...output });
          return value;
        },
      },
      second: {
        key: "secondKey",
        transform: (value, _body, output) => {
          seenOutputs.push({ ...output });
          return value;
        },
      },
    };
    const body: Record<string, any> = { first: "A", second: "B" };

    mapBody(template, body);

    expect(seenOutputs[0]).toEqual({});
    expect(seenOutputs[1]).toEqual({ firstKey: "A" });
  });

  it("should treat null body values as defined and not fall back to default", () => {
    const template: Config["mapBody"] = {
      name: { key: "userName", default: "fallback" },
    };
    const body: Record<string, any> = { name: null };

    const result = mapBody(template, body);

    expect(result.userName).toBeNull();
  });

  it("should preserve falsy non-undefined values (0, false, empty string)", () => {
    const template: Config["mapBody"] = {
      zero: { key: "zeroKey", default: 99 },
      flag: { key: "flagKey", default: true },
      blank: { key: "blankKey", default: "default" },
    };
    const body: Record<string, any> = { zero: 0, flag: false, blank: "" };

    const result = mapBody(template, body);

    expect(result.zeroKey).toBe(0);
    expect(result.flagKey).toBe(false);
    expect(result.blankKey).toBe("");
  });

  it("should expand dot-notation provider keys into nested objects", () => {
    const template: Config["mapBody"] = {
      temp: { key: "config.sampling.temperature" },
      topP: { key: "config.sampling.top_p", default: 1 },
    };
    const body: Record<string, any> = { temp: 0.7 };

    const result = mapBody(template, body);

    expect(result).toEqual({
      config: {
        sampling: {
          temperature: 0.7,
          top_p: 1,
        },
      },
    });
  });

  it("should ignore template entries with non-function transform values", () => {
    const template: Config["mapBody"] = {
      name: { key: "userName", transform: "not-a-function" as any },
    };
    const body: Record<string, any> = { name: "John" };

    const result = mapBody(template, body);

    expect(result.userName).toEqual("John");
  });

  it("should not invoke transform for keys with no providerSpecificKey", () => {
    const transformFn = jest.fn();
    const template: Config["mapBody"] = {
      skipped: { transform: transformFn } as any,
    };
    const body: Record<string, any> = { skipped: "value" };

    const result = mapBody(template, body);

    expect(transformFn).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });
});
