import { parseArgs } from "./args";

describe("parseArgs", () => {
  it("captures the positional path", () => {
    expect(parseArgs(["./summarize.yml"]).path).toBe("./summarize.yml");
  });

  it("parses --data.<key> with a space-separated value", () => {
    expect(parseArgs(["f.yml", "--data.name", "World"]).data).toEqual({
      name: "World",
    });
  });

  it("parses --data.<key>=<value>", () => {
    expect(parseArgs(["f.yml", "--data.name=World"]).data).toEqual({
      name: "World",
    });
  });

  it("nests dotted data keys", () => {
    expect(parseArgs(["f.yml", "--data.user.name", "Greg"]).data).toEqual({
      user: { name: "Greg" },
    });
  });

  it("parses top-level overrides", () => {
    const args = parseArgs([
      "f.yml",
      "--model",
      "gpt-4o",
      "--provider",
      "openai.chat.v1",
      "--parser",
      "json",
    ]);
    expect(args.model).toBe("gpt-4o");
    expect(args.provider).toBe("openai.chat.v1");
    expect(args.parser).toBe("json");
  });

  it("parses --stdin <key>", () => {
    expect(parseArgs(["f.yml", "--stdin", "log"]).stdinKey).toBe("log");
  });

  it("parses boolean flags including short forms", () => {
    expect(parseArgs(["f.yml", "--json", "--debug", "--remote"])).toMatchObject({
      json: true,
      debug: true,
      remote: true,
    });
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-v"]).version).toBe(true);
    expect(parseArgs(["--version"]).version).toBe(true);
  });

  it("throws on an unknown option", () => {
    expect(() => parseArgs(["f.yml", "--nope"])).toThrow(/Unknown option/);
  });

  it("throws when a value flag has no value", () => {
    expect(() => parseArgs(["f.yml", "--model"])).toThrow(/requires a value/);
  });

  it("throws when a boolean flag is given a value", () => {
    expect(() => parseArgs(["f.yml", "--json=1"])).toThrow(/does not take a value/);
  });

  it("throws on bare --data without a key", () => {
    expect(() => parseArgs(["f.yml", "--data", "x"])).toThrow(/--data\.<key>/);
  });

  it("rejects prototype-pollution keys in --data", () => {
    expect(() => parseArgs(["f.yml", "--data.__proto__.x", "y"])).toThrow(
      /Illegal key/
    );
    expect(() => parseArgs(["f.yml", "--data.constructor", "y"])).toThrow(
      /Illegal key/
    );
  });

  it("throws on a second positional argument", () => {
    expect(() => parseArgs(["a.yml", "b.yml"])).toThrow(/Unexpected argument/);
  });
});
