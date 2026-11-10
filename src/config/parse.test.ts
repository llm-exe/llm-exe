import { parseExecutorConfig, formatFromExtension } from "./parse";

const expected = {
  provider: "openai.chat-mock.v1",
  system: "You are a helpful summarizer.",
  message: "Summarize: {{text}}",
  parser: "string",
  data: { text: "hello world" },
};

describe("formatFromExtension", () => {
  it.each([
    ["config.json", "json"],
    ["config.yml", "yaml"],
    ["config.yaml", "yaml"],
    ["config.md", "markdown"],
    ["config.markdown", "markdown"],
    ["https://x.com/a.yml?ref=1#frag", "yaml"],
  ])("infers %s -> %s", (input, format) => {
    expect(formatFromExtension(input)).toBe(format);
  });

  it("returns undefined for unknown / extensionless", () => {
    expect(formatFromExtension("config.txt")).toBeUndefined();
    expect(formatFromExtension("noext")).toBeUndefined();
  });
});

describe("parseExecutorConfig", () => {
  it("parses JSON", async () => {
    const json = JSON.stringify(expected);
    await expect(
      parseExecutorConfig(json, { format: "json" })
    ).resolves.toEqual(expected);
  });

  it("parses YAML", async () => {
    const yaml = [
      "provider: openai.chat-mock.v1",
      "system: You are a helpful summarizer.",
      'message: "Summarize: {{text}}"',
      "parser: string",
      "data:",
      "  text: hello world",
    ].join("\n");
    await expect(
      parseExecutorConfig(yaml, { format: "yaml" })
    ).resolves.toEqual(expected);
  });

  it("parses markdown frontmatter with body as message", async () => {
    const md = [
      "---",
      "provider: openai.chat-mock.v1",
      "system: You are a helpful summarizer.",
      "parser: string",
      "data:",
      "  text: hello world",
      "---",
      "Summarize: {{text}}",
    ].join("\n");
    await expect(
      parseExecutorConfig(md, { format: "markdown" })
    ).resolves.toEqual(expected);
  });

  it("tolerates CRLF line endings in markdown frontmatter", async () => {
    const md = [
      "---",
      "provider: openai.chat-mock.v1",
      "parser: string",
      "---",
      "Hello {{name}}",
    ].join("\r\n");
    const result = await parseExecutorConfig(md, { format: "markdown" });
    expect(result.provider).toBe("openai.chat-mock.v1");
    expect(result.message).toBe("Hello {{name}}");
  });

  it("rejects markdown with BOTH frontmatter message and a body", async () => {
    const md = [
      "---",
      "provider: openai.chat-mock.v1",
      'message: "from frontmatter"',
      "---",
      "from body",
    ].join("\n");
    await expect(
      parseExecutorConfig(md, { format: "markdown" })
    ).rejects.toMatchObject({ code: "configuration.invalid_config" });
  });

  it("allows frontmatter-only markdown (empty body)", async () => {
    const md = [
      "---",
      "provider: openai.chat-mock.v1",
      'message: "from frontmatter"',
      "---",
      "",
    ].join("\n");
    const result = await parseExecutorConfig(md, { format: "markdown" });
    expect(result.message).toBe("from frontmatter");
  });

  it("auto-detects JSON", async () => {
    const result = await parseExecutorConfig(JSON.stringify(expected), {
      format: "auto",
    });
    expect(result).toEqual(expected);
  });

  it("auto-detects markdown with frontmatter", async () => {
    const md = "---\nprovider: openai.chat-mock.v1\n---\nHello";
    const result = await parseExecutorConfig(md, { format: "auto" });
    expect(result.message).toBe("Hello");
  });

  it("auto surfaces invalid_config (not parse_failed) for valid JSON that fails validation", async () => {
    // syntactically valid JSON, but missing required `provider`
    await expect(
      parseExecutorConfig('{"message":"hi"}', { format: "auto" })
    ).rejects.toMatchObject({ code: "configuration.invalid_config" });
  });

  it("wraps malformed JSON in configuration.parse_failed", async () => {
    await expect(
      parseExecutorConfig("{ not json", { format: "json" })
    ).rejects.toMatchObject({ code: "configuration.parse_failed" });
  });

  it("wraps malformed YAML in configuration.parse_failed", async () => {
    await expect(
      parseExecutorConfig("a:\n  - b\n - c", { format: "yaml" })
    ).rejects.toMatchObject({ code: "configuration.parse_failed" });
  });

  it("applies patch fields passed alongside format", async () => {
    const result = await parseExecutorConfig(JSON.stringify(expected), {
      format: "json",
      model: "override-model",
    });
    expect(result.model).toBe("override-model");
  });
});
