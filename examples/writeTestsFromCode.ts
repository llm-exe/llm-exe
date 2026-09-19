// #region file

// #region imports
import {
  createChatPrompt,
  createParser,
  createLlmExecutor,
  useLlm,
} from "llm-exe";
// #endregion imports

// #region prompt
const PROMPT = `As a senior Typescript developer, you write unit tests with 100% test coverage.
  Below is a function, and you need to write unit tests that cover 100% of the branches and functionality. 
  Think step by step before you start writing the tests. Make sure some of your tests expect failures, or try to trick the function.
  We really need good coverage here.
  {{ #if exampleTests }}
  ## Below is an example of how we write jest tests, how we prefer to mock, etc. 
  {{ exampleTests }}
  {{ /if }}
  ## Here is the function:
  \`\`\`ts
  {{ code }}
  \`\`\``;
// #endregion prompt

// #region function
export async function generateTests(sourceCode: string, exampleTests?: string) {
  const llm = useLlm("anthropic.claude-sonnet-4-6");
  const prompt = createChatPrompt<{ code: string; exampleTests?: string }>(
    PROMPT
  );
  const parser = createParser("markdownCodeBlock");
  const testGenExecutor = createLlmExecutor({ llm, prompt, parser });

  return testGenExecutor.execute({ code: sourceCode, exampleTests });
}
// #endregion function

// #endregion file
