import { apiRequestWrapper } from "./requestWrapper";
import { Config } from "@/types";

const config: Config = {
  key: "deepseek.chat.v1",
  provider: "deepseek.chat",
  endpoint: "",
  method: "POST",
  headers: "{}",
  options: {},
  mapBody: {},
};

it("does not retry an actual client timeout or launch another billed call", async () => {
  jest.useFakeTimers();
  try {
    const handler = jest.fn(
      () => new Promise<Record<string, unknown>>(() => {}),
    );
    const llm = apiRequestWrapper(
      config,
      { timeout: 20, numOfAttempts: 3 },
      handler,
    );
    const assertion = expect(llm.call("Hi")).rejects.toMatchObject({
      code: "request.timeout",
      context: { timeout: 20 },
      message: "LLM call timed out after 20ms",
    });
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(handler).toHaveBeenCalledTimes(1);
    expect(llm.getMetadata().metrics).toMatchObject({
      total_call_retry: 0,
      total_call_error: 1,
    });
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it("still retries transient failures through the real backoff wrapper", async () => {
  const handler = jest
    .fn()
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValue({ ok: true });
  const llm = apiRequestWrapper(config, {}, handler);
  await expect(llm.call("Hi")).resolves.toEqual({ ok: true });
  expect(handler).toHaveBeenCalledTimes(2);
});
