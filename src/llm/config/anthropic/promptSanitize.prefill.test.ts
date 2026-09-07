import { anthropicPromptSanitize } from "@/llm/config/anthropic/promptSanitize";
import { IChatMessages } from "@/types";

/**
 * The trailing-assistant ("prefill") warning is gated by a hand-maintained list
 * of model prefixes. That list is the kind of thing that silently rots: a new
 * model ships, nobody adds it, and users get an opaque 400 from Anthropic
 * instead of our warning. These tests pin the gating behavior — which models
 * warn, which don't, and which message shapes trigger the check at all — so a
 * change to the list or to the message-shaping code has to be deliberate.
 */
describe("anthropicPromptSanitize — assistant prefill warning", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const trailingAssistant: IChatMessages = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "prefill" },
  ];

  const sanitize = (messages: IChatMessages, model?: string) => {
    const output: Record<string, any> = {};
    const result = anthropicPromptSanitize(messages, { model }, output);
    return { result, output };
  };

  describe("models that do not support prefills", () => {
    // Exact ids from PREFILL_UNSUPPORTED_MODELS.
    const exact = [
      "claude-opus-5",
      "claude-opus-4-6",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-sonnet-5",
      "claude-fable-5",
    ];

    it.each(exact)("warns for exact model id %s", (model) => {
      sanitize(trailingAssistant, model);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(model);
      expect(warn.mock.calls[0][0]).toContain("does not support assistant message prefills");
    });

    it("warns for dated snapshot ids built from a known prefix", () => {
      sanitize(trailingAssistant, "claude-opus-4-6-20260101");
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("does not warn on a prefix match that is not followed by a dash", () => {
      // "claude-opus-50" must not be treated as "claude-opus-5" + suffix.
      sanitize(trailingAssistant, "claude-opus-50");
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("models that still support prefills", () => {
    it.each([
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-20241022",
    ])("stays silent for %s", (model) => {
      sanitize(trailingAssistant, model);
      expect(warn).not.toHaveBeenCalled();
    });

    it("stays silent when no model is supplied", () => {
      const output: Record<string, any> = {};
      anthropicPromptSanitize(trailingAssistant, {}, output);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("message shapes that should not warn", () => {
    it("does not warn when the trailing message is a user message", () => {
      sanitize(
        [
          { role: "assistant", content: "earlier" },
          { role: "user", content: "hello" },
        ],
        "claude-opus-5"
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not warn for a bare string prompt", () => {
      anthropicPromptSanitize("just a string", { model: "claude-opus-5" }, {});
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not warn for an empty messages array", () => {
      const { result } = sanitize([], "claude-opus-5");
      expect(result).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not warn for a lone system message promoted to user", () => {
      const { result } = sanitize(
        [{ role: "system", content: "you are a bot" }],
        "claude-opus-5"
      );
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("warning fires after system extraction and merging", () => {
    it("warns when a leading system message is hoisted out and assistant trails", () => {
      const { result, output } = sanitize(
        [
          { role: "system", content: "you are a bot" },
          { role: "user", content: "hello" },
          { role: "assistant", content: "prefill" },
        ],
        "claude-opus-5"
      );
      expect(output.system).toBe("you are a bot");
      expect(result[result.length - 1].role).toBe("assistant");
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it("warns exactly once even when consecutive assistant messages merge into one", () => {
      const { result } = sanitize(
        [
          { role: "user", content: [{ type: "text", text: "hello" }] },
          { role: "assistant", content: [{ type: "text", text: "a" }] },
          { role: "assistant", content: [{ type: "text", text: "b" }] },
        ] as unknown as IChatMessages,
        "claude-opus-5"
      );
      expect(result).toHaveLength(2);
      expect(result[result.length - 1].role).toBe("assistant");
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });
});
