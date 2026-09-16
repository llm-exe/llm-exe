export const asyncCallWithTimeout = async <T = any>(
  asyncPromise: Promise<T>,
  timeLimit = 10000
): Promise<T> => {
  let timeoutHandle: any;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      return reject(
        new Error(`LLM call timed out after ${timeLimit}ms`)
      );
    }, timeLimit);
  });

  return Promise.race([asyncPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  }) as Promise<T>;
};
