import { useLlm, createChatPrompt, createParser, createLlmExecutor } from "llm-exe"

export function basicExampleUsingPrompt(){
    const prompt = createChatPrompt();
    prompt.addUserMessage("Hello, how are you?");
    prompt.addAssistantMessage("I'm good, how are you?");
}

export async function basicExampleUsingLlm(){
    const llm = useLlm("openai.gpt-6-luna");
    const response = await llm.call("Hello, how are you?");
    console.log(response.getResultText()); // "I'm good, how are you?"
}

export async function basicExamplePromptAndLlm(){
    const llm = useLlm("openai.gpt-6-luna");
    const prompt = createChatPrompt();
    prompt.addUserMessage("Hello, how are you?");
    prompt.addAssistantMessage("I'm good, how are you?");
    const response = await llm.call(prompt.format({}));
    console.log(response.getResultText()); // "I'm good, how are you?"
}

export async function basicExamplePromptAndLlmAndParser(){
    const llm = useLlm("openai.gpt-6-luna");
    const prompt = createChatPrompt();
    const parser = createParser("listToArray");
    prompt.addUserMessage("Hello, how are you?");
    prompt.addAssistantMessage("I'm good, how are you?");
    const input = prompt.format({})
    const response = await llm.call(input);
    const output = parser.parse(response.getResultText());
    console.log(output); // "I'm good, how are you?"
}

export async function basicExampleUsingLlmExecutor(){
    const llm = useLlm("openai.gpt-6-luna");
    const prompt = createChatPrompt();
    const parser = createParser("listToArray");
    prompt.addUserMessage("Hello, how are you?");
    prompt.addAssistantMessage("I'm good, how are you?");
    const executor = createLlmExecutor({llm, prompt, parser});
    const response = await executor.execute({})
    console.log(response); // "I'm good, how are you?"
}

