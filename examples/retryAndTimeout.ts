// #region file
// #region imports
import {
  useLlm,
  createChatPrompt,
  createParser,
  createLlmExecutor,
  isLlmExeError,
} from "llm-exe";
// #endregion imports

// #region function
export function createSummarizer() {
  const llm = useLlm("openai.gpt-4o-mini", {
    timeout: 15000, // fail any single API call after 15 seconds
    numOfAttempts: 3, // make up to 3 attempts before throwing
    maxDelay: 5000, // cap the backoff wait between attempts at 5 seconds
  });

  return createLlmExecutor({
    name: "summarize",
    llm,
    prompt: createChatPrompt<{ text: string }>(
      "Summarize the following in one sentence: {{text}}"
    ),
    parser: createParser("string"),
  });
}
// #endregion function

// #region usage
export async function summarize(text: string): Promise<string | null> {
  const summarizer = createSummarizer();

  summarizer.on("onError", (exec, meta) => {
    console.error(`${meta.name} failed after retries:`, exec.errorMessage);
  });

  try {
    return await summarizer.execute({ text });
  } catch (error) {
    if (isLlmExeError(error)) {
      // error.code identifies what failed (timeout, provider error,
      // parse failure) so you can decide the right fallback per case.
      return null;
    }
    throw error;
  }
}
// #endregion usage
// #endregion file
