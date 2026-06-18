import { join } from "node:path";
import { runCli, type CliIO } from "./runCli";

const FIXTURES = join(__dirname, "..", "config", "__fixtures__");
const summarize = join(FIXTURES, "summarize.yml");
const weather = join(FIXTURES, "weather.yml");

function makeIO(stdin = ""): {
  io: CliIO;
  out: () => string;
  err: () => string;
} {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  return {
    io: {
      stdout: (t) => outChunks.push(t),
      stderr: (t) => errChunks.push(t),
      readStdin: async () => stdin,
      version: "9.9.9",
    },
    out: () => outChunks.join("\n"),
    err: () => errChunks.join("\n"),
  };
}

describe("runCli", () => {
  it("prints help and exits 0", async () => {
    const { io, out } = makeIO();
    expect(await runCli(["--help"], io)).toBe(0);
    expect(out()).toContain("Usage:");
  });

  it("prints version and exits 0", async () => {
    const { io, out } = makeIO();
    expect(await runCli(["--version"], io)).toBe(0);
    expect(out()).toContain("9.9.9");
  });

  it("errors (exit 1) when no path is given", async () => {
    const { io, err } = makeIO();
    expect(await runCli([], io)).toBe(1);
    expect(err()).toContain("Missing config path");
  });

  it("errors on a malformed flag without crashing", async () => {
    const { io, err } = makeIO();
    expect(await runCli(["f.yml", "--nope"], io)).toBe(1);
    expect(err()).toContain("Unknown option");
  });

  it("runs a config file against the mock provider and prints the result", async () => {
    const { io, out } = makeIO();
    expect(await runCli([summarize], io)).toBe(0);
    // mock echoes the rendered prompt, which interpolated data.text = "hello world"
    expect(out()).toContain("hello world");
  });

  it("applies --data overrides (caller > file)", async () => {
    const { io, out } = makeIO();
    expect(await runCli([summarize, "--data.text", "OVERRIDDEN"], io)).toBe(0);
    expect(out()).toContain("OVERRIDDEN");
  });

  it("binds piped stdin to a data variable with --stdin", async () => {
    const { io, out } = makeIO("PIPED CONTENT");
    expect(await runCli([summarize, "--stdin", "text"], io)).toBe(0);
    expect(out()).toContain("PIPED CONTENT");
  });

  it("emits a { result, metadata } envelope with --json", async () => {
    const { io, out } = makeIO();
    expect(await runCli([summarize, "--json"], io)).toBe(0);
    const parsed = JSON.parse(out());
    expect(parsed).toHaveProperty("result");
    expect(parsed).toHaveProperty("metadata");
  });

  it("writes metadata to stderr (not stdout) with --debug", async () => {
    const { io, out, err } = makeIO();
    expect(await runCli([summarize, "--debug"], io)).toBe(0);
    expect(err().length).toBeGreaterThan(0);
    expect(out()).toContain("hello world");
  });

  it("runs a config with function/tool schemas", async () => {
    const { io } = makeIO();
    expect(await runCli([weather], io)).toBe(0);
  });

  it("refuses a remote URL without --remote (confused-deputy guard)", async () => {
    const { io, err } = makeIO();
    expect(await runCli(["https://example.com/c.yml"], io)).toBe(1);
    expect(err()).toContain("--remote");
  });

  it("maps a missing file to a clean error and exit 1", async () => {
    const { io, err } = makeIO();
    expect(await runCli([join(FIXTURES, "nope.yml")], io)).toBe(1);
    expect(err()).toContain("configuration.file_not_found");
  });
});
