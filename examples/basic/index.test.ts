import { useLlm, createChatPrompt, createParser } from "llm-exe"

import { basicExampleUsingPrompt, basicExampleUsingLlm, basicExamplePromptAndLlm, basicExamplePromptAndLlmAndParser,  } from "./index";

jest.mock("llm-exe", () => ({
  ...jest.requireActual("llm-exe"),
  useLlm: jest.fn(),
  createChatPrompt: jest.fn(),
  createParser: jest.fn(),
}));

describe("basicExampleUsingPrompt", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create a chat prompt and add user and assistant messages", () => {
        const addUserMessageMock = jest.fn();
        const addAssistantMessageMock = jest.fn();
        
        (createChatPrompt as jest.Mock).mockReturnValue({
            addUserMessage: addUserMessageMock,
            addAssistantMessage: addAssistantMessageMock,
        });

        basicExampleUsingPrompt();

        expect(createChatPrompt).toHaveBeenCalled();
        expect(addUserMessageMock).toHaveBeenCalledWith("Hello, how are you?");
        expect(addAssistantMessageMock).toHaveBeenCalledWith("I'm good, how are you?");
    });
});

describe("basicExampleUsingLlm", () => {
    it("should call the LLM and log the response", async () => {
        const callMock = jest.fn().mockResolvedValue({
            getResultText: jest.fn().mockReturnValue("I'm good, how are you?")
        });
        const useLlmMock = jest.fn().mockReturnValue({
            call: callMock
        });

        (useLlm as jest.Mock).mockImplementation(useLlmMock);
        console.log = jest.fn();

        await basicExampleUsingLlm();

        expect(useLlm).toHaveBeenCalledWith("openai.gpt-6-luna");
        expect(callMock).toHaveBeenCalledWith("Hello, how are you?");
        expect(console.log).toHaveBeenCalledWith("I'm good, how are you?");
    });
});

describe("basicExamplePromptAndLlm", () => {
    it("should create a chat prompt, call the LLM with formatted prompt, and log the response", async () => {
        const addUserMessageMock = jest.fn();
        const addAssistantMessageMock = jest.fn();
        const formatMock = jest.fn().mockReturnValue("formatted prompt");
        const callMock = jest.fn().mockResolvedValue({
            getResultText: jest.fn().mockReturnValue("I'm good, how are you?")
        });
        const useLlmMock = jest.fn().mockReturnValue({
            call: callMock
        });

        (createChatPrompt as jest.Mock).mockReturnValue({
            addUserMessage: addUserMessageMock,
            addAssistantMessage: addAssistantMessageMock,
            format: formatMock
        });
        (useLlm as jest.Mock).mockImplementation(useLlmMock);
        console.log = jest.fn();

        await basicExamplePromptAndLlm();

        expect(createChatPrompt).toHaveBeenCalled();
        expect(addUserMessageMock).toHaveBeenCalledWith("Hello, how are you?");
        expect(addAssistantMessageMock).toHaveBeenCalledWith("I'm good, how are you?");
        expect(formatMock).toHaveBeenCalledWith({});
        expect(useLlm).toHaveBeenCalledWith("openai.gpt-6-luna");
        expect(callMock).toHaveBeenCalledWith("formatted prompt");
        expect(console.log).toHaveBeenCalledWith("I'm good, how are you?");
    });
});

describe("basicExamplePromptAndLlmAndParser", () => {
    it("should create a chat prompt, call the LLM with formatted prompt, parse the response, and log the output", async () => {
        const addUserMessageMock = jest.fn();
        const addAssistantMessageMock = jest.fn();
        const formatMock = jest.fn().mockReturnValue("formatted prompt");
        const callMock = jest.fn().mockResolvedValue({
            getResultText: jest.fn().mockReturnValue("I'm good, how are you?")
        });
        const parseMock = jest.fn().mockReturnValue("parsed output");
        const useLlmMock = jest.fn().mockReturnValue({
            call: callMock
        });
        const createParserMock = jest.fn().mockReturnValue({
            parse: parseMock
        });

        (createChatPrompt as jest.Mock).mockReturnValue({
            addUserMessage: addUserMessageMock,
            addAssistantMessage: addAssistantMessageMock,
            format: formatMock
        });
        (useLlm as jest.Mock).mockImplementation(useLlmMock);
        (createParser as jest.Mock).mockImplementation(createParserMock);
        console.log = jest.fn();

        await basicExamplePromptAndLlmAndParser();

        expect(createChatPrompt).toHaveBeenCalled();
        expect(addUserMessageMock).toHaveBeenCalledWith("Hello, how are you?");
        expect(addAssistantMessageMock).toHaveBeenCalledWith("I'm good, how are you?");
        expect(formatMock).toHaveBeenCalledWith({});
        expect(useLlm).toHaveBeenCalledWith("openai.gpt-6-luna");
        expect(callMock).toHaveBeenCalledWith("formatted prompt");
        expect(createParser).toHaveBeenCalledWith("listToArray");
        expect(parseMock).toHaveBeenCalledWith("I'm good, how are you?");
        expect(console.log).toHaveBeenCalledWith("parsed output");
    });
});

