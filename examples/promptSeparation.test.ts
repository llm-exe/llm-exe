import {
  draftSupportReply,
  renderSupportReplyPrompt,
} from "./promptSeparation";

describe("promptSeparation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Runs offline - rendering a prompt does not call an LLM.
  it("renders the template with the provided variables", () => {
    const rendered = renderSupportReplyPrompt({
      companyName: "Acme",
      message: "My widget arrived broken.",
    });

    const asText = JSON.stringify(rendered);
    expect(asText).toContain("Acme");
    expect(asText).toContain("My widget arrived broken.");
    expect(asText).not.toContain("{{companyName}}");
  });

  it("drafts a reply using the separated prompt", async () => {
    const reply = await draftSupportReply({
      companyName: "Acme",
      message: "My widget arrived broken. Can you help?",
    });

    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(0);
  });
});
