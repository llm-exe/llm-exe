import { anthropicPromptSanitize } from "@/llm/config/anthropic/promptSanitize";
import { bedrock } from "@/llm/config/bedrock";
import { mapBody } from "@/llm/_utils.mapBody";
import { PROVIDED_OPTION_KEYS } from "@/llm/_utils.stateFromOptions";
import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";

// Mock the external dependencies
jest.mock("@/utils/modules/replaceTemplateString", () => ({
  replaceTemplateString: jest.fn(),
}));

jest.mock("@/llm/config/anthropic/promptSanitize", () => ({
  anthropicPromptSanitize: jest.fn(),
}));

const replaceTemplateStringMock = replaceTemplateString as jest.Mock;
const anthropicPromptSanitizeMock = anthropicPromptSanitize as jest.Mock;

describe("bedrock configuration", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, AWS_REGION: "us-west-2" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("amazon:anthropic.chat.v1 configuration", () => {
    it("should have the correct endpoint with AWS region placeholder", () => {
      expect(bedrock["amazon:anthropic.chat.v1"].endpoint).toBe(
        "https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke"
      );
    });

    it("should have the correct default mapBody values", () => {
      expect(
        bedrock["amazon:anthropic.chat.v1"].mapBody.maxTokens.default
      ).toBe(10000);
      expect(
        bedrock["amazon:anthropic.chat.v1"].mapBody.anthropic_version.default
      ).toBe("bedrock-2023-05-31");
    });
    it("should transform prompt using anthropicPromptSanitize", () => {
      const messages = "test message";
      anthropicPromptSanitizeMock.mockReturnValue("transformd message");
      const cn = bedrock["amazon:anthropic.chat.v1"];
      const transformd = cn?.mapBody?.prompt?.transform
        ? cn?.mapBody?.prompt?.transform(messages, {}, {})
        : () => {};
      expect(transformd).toBe("transformd message");
      expect(anthropicPromptSanitizeMock).toHaveBeenCalledWith(messages, {}, {}, {
        provider: "amazon:anthropic.chat",
        allowImageUrlSources: false,
      });
    });
  });

  // Bedrock reuses the direct provider's effort/thinking + sampling-param
  // handling (../anthropic/effort). These assert the outgoing InvokeModel body
  // via mapBody with real Bedrock invoke model IDs (the prompt sanitizer is
  // mocked above, but the effort/topP transforms are the real shared ones).
  describe("amazon:anthropic.chat.v1 effort / thinking / sampling params", () => {
    const cfg = bedrock["amazon:anthropic.chat.v1"];
    const bodyWith = (
      model: string,
      opts: Record<string, any>,
      provided: string[]
    ) =>
      mapBody(cfg.mapBody, {
        model,
        ...opts,
        [PROVIDED_OPTION_KEYS]: new Set(provided),
      });

    it("escalates effort high->xhigh + adaptive and applies the 65536 floor for opus-4-8 (no caller maxTokens)", () => {
      const body = bodyWith(
        "us.anthropic.claude-opus-4-8",
        { effort: "high" },
        ["effort"]
      );
      expect(body.output_config).toEqual({ effort: "xhigh" });
      expect(body.thinking).toEqual({ type: "adaptive" });
      expect(body.max_tokens).toBe(65536);
    });

    it("honors an explicit maxTokens for opus-4-8 when escalating", () => {
      const body = bodyWith(
        "us.anthropic.claude-opus-4-8",
        { effort: "high", maxTokens: 8000 },
        ["effort", "maxTokens"]
      );
      expect(body.output_config).toEqual({ effort: "xhigh" });
      expect(body.max_tokens).toBe(8000);
    });

    it("maps effort to legacy budget thinking + raises max_tokens for a legacy Bedrock model (sonnet-4-5)", () => {
      const body = bodyWith(
        "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        { effort: "medium" },
        ["effort"]
      );
      // Legacy models take enabled thinking with a budget, not output_config;
      // max_tokens is raised above the budget (Anthropic requires max_tokens >
      // budget_tokens), overriding the 10000 Bedrock default here (10000 <= 10240).
      expect(body).not.toHaveProperty("output_config");
      expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 10240 });
      expect(body.max_tokens).toBeGreaterThan(10240);
    });

    it("keeps effort high (no escalation) + adaptive for opus-5, leaving the Bedrock default max_tokens", () => {
      const body = bodyWith(
        "global.anthropic.claude-opus-5",
        { effort: "high" },
        ["effort"]
      );
      expect(body.output_config).toEqual({ effort: "high" });
      expect(body.thinking).toEqual({ type: "adaptive" });
      expect(body.max_tokens).toBe(10000);
    });

    it("drops top_p for a 4.7+/5 model (Bedrock 400s on sampling params there)", () => {
      const body = bodyWith(
        "us.anthropic.claude-opus-4-8",
        { effort: "high", topP: 0.9 },
        ["effort", "topP"]
      );
      expect(body.top_p).toBeUndefined();
    });

    it("keeps top_p for a non-reject model", () => {
      const body = bodyWith(
        "us.anthropic.claude-sonnet-4-6",
        { topP: 0.9 },
        ["topP"]
      );
      expect(body.top_p).toBe(0.9);
    });

    it("drops top_p on a non-reject model when effort enables thinking (issue #716)", () => {
      const body = bodyWith(
        "us.anthropic.claude-sonnet-4-6",
        { effort: "high", topP: 0.9 },
        ["effort", "topP"]
      );
      expect(body.thinking).toEqual({ type: "adaptive" });
      expect(body.top_p).toBeUndefined();
    });

    it("keeps top_p >= 0.95 on a non-reject model when effort enables thinking (issue #716)", () => {
      const body = bodyWith(
        "us.anthropic.claude-sonnet-4-6",
        { effort: "high", topP: 0.97 },
        ["effort", "topP"]
      );
      expect(body.top_p).toBe(0.97);
    });

    it("adds no effort/thinking fields when effort is not provided", () => {
      const body = bodyWith("us.anthropic.claude-opus-4-8", {}, []);
      expect(body).not.toHaveProperty("output_config");
      expect(body).not.toHaveProperty("thinking");
    });
  });

  describe("amazon:anthropic.chat.v1 mapOptions", () => {
    it("should handle functionCall 'none' by returning _clearFunctions", () => {
      const mapOptions = bedrock["amazon:anthropic.chat.v1"].mapOptions!;
      const result = mapOptions.functionCall!("none", {});
      expect(result).toEqual({ _clearFunctions: true });
    });

    it("should handle functionCall 'auto'", () => {
      const mapOptions = bedrock["amazon:anthropic.chat.v1"].mapOptions!;
      const result = mapOptions.functionCall!("auto", {});
      expect(result).toEqual({ tool_choice: { type: "auto" } });
    });

    it("should handle functionCall 'any'", () => {
      const mapOptions = bedrock["amazon:anthropic.chat.v1"].mapOptions!;
      const result = mapOptions.functionCall!("any", {});
      expect(result).toEqual({ tool_choice: { type: "any" } });
    });

    it("should handle specific functionCall value", () => {
      const mapOptions = bedrock["amazon:anthropic.chat.v1"].mapOptions!;
      const specificCall = { type: "tool", name: "my_tool" };
      const result = mapOptions.functionCall!(specificCall as any, {});
      expect(result).toEqual({ tool_choice: specificCall });
    });

    it("should transform functions to anthropic tools format", () => {
      const mapOptions = bedrock["amazon:anthropic.chat.v1"].mapOptions!;
      const functions = [
        {
          name: "get_weather",
          description: "Get weather data",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
      ];
      const result = mapOptions.functions!(functions, {});
      expect(result).toEqual({
        tools: [
          {
            name: "get_weather",
            description: "Get weather data",
            input_schema: expect.objectContaining({
              type: "object",
              properties: { city: { type: "string" } },
            }),
          },
        ],
      });
    });
  });

  describe("amazon:meta.chat.v1 configuration", () => {
    it("should have the correct endpoint with AWS region placeholder", () => {
      expect(bedrock["amazon:meta.chat.v1"].endpoint).toBe(
        "https://bedrock-runtime.{{awsRegion}}.amazonaws.com/model/{{model}}/invoke"
      );
    });

    it("should have the correct default mapBody values", () => {
      expect(bedrock["amazon:meta.chat.v1"].mapBody.maxTokens.default).toBe(
        2048
      );
    });

    it("should transform prompt appropriately", () => {
      const stringPrompt = "test string message";
      const objectMessages = [{ msg: "message1" }, { msg: "message2" }];
      const replacedString = "replaced string";

      replaceTemplateStringMock.mockReturnValue(replacedString);
      const fn1 = bedrock["amazon:meta.chat.v1"];
      const transformString = fn1.mapBody.prompt.transform
        ? fn1.mapBody.prompt.transform(stringPrompt, {}, {})
        : () => {};
      expect(transformString).toBe(stringPrompt);
      const fn2 = bedrock["amazon:meta.chat.v1"];
      const transformObject = fn2?.mapBody?.prompt?.transform
        ? fn2?.mapBody?.prompt?.transform(objectMessages, {}, {})
        : () => {};
      expect(transformObject).toBe(replacedString);
      expect(replaceTemplateStringMock).toHaveBeenCalledWith(
        "{{>DialogueHistory key='messages'}}",
        { messages: objectMessages }
      );
    });

    it("should reject messages containing image content", () => {
      const messagesWithImage = [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
            },
          ],
        },
      ];

      const fn = bedrock["amazon:meta.chat.v1"];
      expect(() =>
        fn.mapBody.prompt.transform
          ? fn.mapBody.prompt.transform(messagesWithImage, {}, {})
          : undefined
      ).toThrow(/Image content is not supported/);
      expect(replaceTemplateStringMock).not.toHaveBeenCalled();
    });
  });
});
