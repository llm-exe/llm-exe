import { getChatCompletionUsage } from "./getChatCompletionUsage";

const totals = {
  prompt_tokens: 100,
  completion_tokens: 20,
  total_tokens: 120,
};

describe("getChatCompletionUsage", () => {
  it("maps OpenAI-compatible totals onto normalized usage", () => {
    expect(getChatCompletionUsage(totals)).toEqual({
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
    });
  });

  it("omits cache fields entirely when the provider reports none", () => {
    const usage = getChatCompletionUsage(totals);
    expect(usage).not.toHaveProperty("cache_read_input_tokens");
    expect(usage).not.toHaveProperty("cache_creation_input_tokens");
  });

  describe("cache read source", () => {
    it("reads OpenAI's nested cached_tokens", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_tokens_details: { cached_tokens: 60 },
        }),
      ).toEqual({
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        cache_read_input_tokens: 60,
      });
    });

    it("reads DeepSeek's flat prompt_cache_hit_tokens", () => {
      expect(
        getChatCompletionUsage({ ...totals, prompt_cache_hit_tokens: 60 })
          .cache_read_input_tokens,
      ).toEqual(60);
    });

    it("prefers the flat DeepSeek count over nested details when both are present", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_cache_hit_tokens: 60,
          prompt_tokens_details: { cached_tokens: 10 },
        }).cache_read_input_tokens,
      ).toEqual(60);
    });

    it("treats a flat zero cache hit as reported, not as a reason to fall back to details", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_cache_hit_tokens: 0,
          prompt_tokens_details: { cached_tokens: 10 },
        }).cache_read_input_tokens,
      ).toEqual(0);
    });

    it("falls back to nested details when the flat count is null", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_cache_hit_tokens: null,
          prompt_tokens_details: { cached_tokens: 10 },
        }).cache_read_input_tokens,
      ).toEqual(10);
    });

    it.each([
      ["zero", 0, 0],
      ["null", null, undefined],
      ["undefined", undefined, undefined],
    ])(
      "distinguishes a %s nested cached_tokens from a missing one",
      (_label, cached_tokens, expected) => {
        const usage = getChatCompletionUsage({
          ...totals,
          prompt_tokens_details: { cached_tokens },
        });
        if (expected === undefined) {
          expect(usage).not.toHaveProperty("cache_read_input_tokens");
        } else {
          expect(usage.cache_read_input_tokens).toEqual(expected);
        }
      },
    );

    it.each([null, undefined])(
      "omits cache read when prompt_tokens_details is %s",
      (details) => {
        expect(
          getChatCompletionUsage({ ...totals, prompt_tokens_details: details }),
        ).not.toHaveProperty("cache_read_input_tokens");
      },
    );
  });

  describe("cache write source", () => {
    it("maps cache_write_tokens to cache_creation_input_tokens", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 30 },
        }),
      ).toEqual({
        input_tokens: 100,
        output_tokens: 20,
        total_tokens: 120,
        cache_read_input_tokens: 60,
        cache_creation_input_tokens: 30,
      });
    });

    it("preserves a reported zero cache write rather than dropping it", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_tokens_details: { cache_write_tokens: 0 },
        }).cache_creation_input_tokens,
      ).toEqual(0);
    });

    it("omits cache write when reported as null", () => {
      expect(
        getChatCompletionUsage({
          ...totals,
          prompt_tokens_details: { cache_write_tokens: null },
        }),
      ).not.toHaveProperty("cache_creation_input_tokens");
    });

    it("reports a cache write without a cache read", () => {
      const usage = getChatCompletionUsage({
        ...totals,
        prompt_tokens_details: { cache_write_tokens: 30 },
      });
      expect(usage.cache_creation_input_tokens).toEqual(30);
      expect(usage).not.toHaveProperty("cache_read_input_tokens");
    });

    it("never derives a cache write from the flat DeepSeek cache-hit count", () => {
      expect(
        getChatCompletionUsage({ ...totals, prompt_cache_hit_tokens: 60 }),
      ).not.toHaveProperty("cache_creation_input_tokens");
    });
  });

  describe("missing usage", () => {
    it.each([undefined, null])(
      "returns undefined totals without throwing when usage is %s",
      (usage) => {
        expect(getChatCompletionUsage(usage as any)).toEqual({
          input_tokens: undefined,
          output_tokens: undefined,
          total_tokens: undefined,
        });
      },
    );

    it("does not invent cache fields when usage is absent", () => {
      const usage = getChatCompletionUsage(undefined as any);
      expect(usage).not.toHaveProperty("cache_read_input_tokens");
      expect(usage).not.toHaveProperty("cache_creation_input_tokens");
    });

    it("passes through partial totals without coercing them to zero", () => {
      expect(getChatCompletionUsage({ prompt_tokens: 100 } as any)).toEqual({
        input_tokens: 100,
        output_tokens: undefined,
        total_tokens: undefined,
      });
    });
  });

  it("does not treat cached input as additive to the reported total", () => {
    const usage = getChatCompletionUsage({
      ...totals,
      prompt_tokens_details: { cached_tokens: 60, cache_write_tokens: 30 },
    });
    expect(usage.total_tokens).toEqual(120);
    expect(usage.input_tokens).toEqual(100);
  });
});
