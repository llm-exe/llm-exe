import { anthropicPromptSanitize } from "@/llm/config/anthropic/promptSanitize";
import { bedrock } from "@/llm/config/bedrock";
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
