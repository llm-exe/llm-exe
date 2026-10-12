import { LlmExeError } from "@/errors";

export const asyncCallWithTimeout = async <T = any>(
  asyncPromise: Promise<T>,
  timeLimit = 10000
): Promise<T> => {
  let timeoutHandle: any;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      return reject(
        new LlmExeError(`LLM call timed out after ${timeLimit}ms`, {
          code: "request.timeout",
          context: { operation: "asyncCallWithTimeout", timeout: timeLimit },
        })
      );
    }, timeLimit);
  });

  return Promise.race([asyncPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  }) as Promise<T>;
};
