import { get } from "@/utils/modules/get";
import { pick } from "@/utils/modules/pick";
import { Config, GenericLLm, LlmProvider } from "@/types";
import {
  stateFromOptions,
  PROVIDED_OPTION_KEYS,
} from "@/llm/_utils.stateFromOptions";
import { LlmExeError } from "@/errors";

describe("stateFromOptions", () => {
  const mockGet = jest.fn(get);
  const mockPick = jest.fn(pick);

  jest.mock("@/utils/modules/pick", () => ({
    pick: mockPick,
  }));

  jest.mock("@/utils/modules/get", () => ({
    get: mockGet,
  }));

  const options: Partial<GenericLLm> = { model: "gpt-3" };
  const config: Config = {
    key: "openai.chat.v1",
    provider: "openai.chat",
    options: {
      temperature: { default: 0.7, required: [true] },
      maxTokens: { required: [true, "Error: [maxTokens] is required"] },
    },
    headers: '{"Authorization": "Bearer {{token}}"}',
    endpoint: "",
    mapBody: {},
    method: "POST",
    transformResponse: () => ({
      id: "",
      name: "",
      created: 0,
      content: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      stopReason: "stop",
    }),
  };

  beforeEach(() => {
    mockGet.mockClear();
    mockPick.mockClear();
  });

  it("should return state with picked options, provider, and model", () => {
    const optionsWithMaxTokens: Partial<GenericLLm> = {
      model: "gpt-3",
      maxTokens: 100,
    };

    mockPick.mockReturnValueOnce(optionsWithMaxTokens);
    mockGet.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

    const state = stateFromOptions(optionsWithMaxTokens, config);

    expect(state).toEqual({
      model: "gpt-3",
      key: "openai.chat.v1",
      provider: "openai.chat",
      temperature: 0.7,
      maxTokens: 100,
      // enumerable Symbol marker (issue #712); jest compares enumerable symbols
      [PROVIDED_OPTION_KEYS]: expect.any(Set),
    });
  });

  it("should throw error if any required config is missing", () => {
    mockPick.mockReturnValueOnce({ model: "gpt-3" });
    mockGet.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

    expect(() => stateFromOptions(options, config)).toThrowError(
      "Error: [maxTokens] is required"
    );
  });

  it("throws LlmExeError with configuration.missing_option for a missing required option", () => {
    mockPick.mockReturnValueOnce({ model: "gpt-3" });
    mockGet.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

    try {
      stateFromOptions(options, config);
      fail("Expected an error to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(LlmExeError);
      expect((e as LlmExeError).code).toBe("configuration.missing_option");
      expect((e as LlmExeError).category).toBe("configuration");
      const ctx = (e as LlmExeError).context as Record<string, unknown>;
      expect(ctx.operation).toBe("stateFromOptions");
      expect(ctx.provider).toBe("openai.chat");
      expect(ctx.key).toBe("openai.chat.v1");
      expect(ctx.option).toBe("maxTokens");
    }
  });

  it("should not throw error if required config is provided", () => {
    const optionsWithMaxTokens: Partial<GenericLLm> = {
      model: "gpt-3",
      maxTokens: 100,
    };
    mockPick.mockReturnValueOnce({ model: "gpt-3", maxTokens: 100 });
    mockGet.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);

    expect(() => stateFromOptions(optionsWithMaxTokens, config)).not.toThrow();
  });

  it("should handle undefined default values correctly", () => {
    const configWithoutDefaults = {
      provider: "openai" as LlmProvider,
      options: {
        maxTokens: { required: [true, "Field is required"] },
      },
    } as unknown as Config;

    mockPick.mockReturnValueOnce({ model: "gpt-3" });
    mockGet.mockReturnValueOnce(undefined);

    expect(() => stateFromOptions(options, configWithoutDefaults)).toThrowError(
      "Field is required"
    );
  });

  it("should not set value if default is not provided and property is not required", () => {
    const optionalConfig: Config = {
      key: "openai.chat.v1",
      provider: "openai.chat",
      options: {
        optionalField: { required: [false] },
      },
      headers: '{"Authorization": "Bearer {{token}}"}',
      endpoint: "",
      mapBody: {},
      method: "POST",
      transformResponse: () => ({
        id: "",
        name: "",
        created: 0,
        content: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        stopReason: "stop",
      }),
    };

    mockPick.mockReturnValueOnce({ model: "gpt-3" });
    mockGet.mockReturnValueOnce(undefined);

    const state = stateFromOptions(options, optionalConfig);

    expect(state).toEqual({
      model: "gpt-3",
      key: "openai.chat.v1",
      provider: "openai.chat",
      // enumerable Symbol marker (issue #712); jest compares enumerable symbols
      [PROVIDED_OPTION_KEYS]: expect.any(Set),
    });
  });

  // issue #712: mapBody transforms need to distinguish a caller-set value from a
  // defaulted one. stateFromOptions records the caller-provided keys under a
  // Symbol on state. It is invisible to Object.keys / JSON.stringify (so it
  // cannot leak into a request body) but left enumerable so it auto-propagates
  // through the Object.assign bodies the call handlers build for mapBody.
  describe("caller-provided option provenance (issue #712)", () => {
    it("records only caller-provided keys, excluding those filled from defaults", () => {
      // temperature is omitted (filled from its 0.7 default); maxTokens is set.
      const state = stateFromOptions({ model: "gpt-3", maxTokens: 100 }, config);

      const provided = (state as any)[PROVIDED_OPTION_KEYS] as Set<string>;
      expect(provided).toBeInstanceOf(Set);
      expect(provided.has("maxTokens")).toBe(true);
      expect(provided.has("temperature")).toBe(false);
    });

    it("keeps the Symbol marker out of Object.keys / JSON so it cannot leak to the wire", () => {
      const state = stateFromOptions({ model: "gpt-3", maxTokens: 100 }, config);

      expect(Object.getOwnPropertySymbols(state)).toContain(PROVIDED_OPTION_KEYS);
      expect(Object.keys(state)).not.toContain("providedOptionKeys");
      expect(JSON.stringify(state)).not.toContain("providedOptionKeys");
      expect(JSON.parse(JSON.stringify(state))).toEqual({
        model: "gpt-3",
        key: "openai.chat.v1",
        provider: "openai.chat",
        temperature: 0.7,
        maxTokens: 100,
      });
    });

    it("auto-propagates through Object.assign / spread so mapBody call sites need no extra wiring", () => {
      const state = stateFromOptions({ model: "gpt-3", maxTokens: 100 }, config);
      const marker = (state as any)[PROVIDED_OPTION_KEYS];

      // This is how the llm / embedding call handlers build the mapBody input.
      expect((Object.assign({}, state) as any)[PROVIDED_OPTION_KEYS]).toBe(marker);
      expect(({ ...state } as any)[PROVIDED_OPTION_KEYS]).toBe(marker);
    });
  });
});
