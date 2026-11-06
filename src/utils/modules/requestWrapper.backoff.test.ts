import { apiRequestWrapper } from "./requestWrapper";
import { LlmExeError } from "@/errors";
import { Config } from "@/types";

// Uses the real exponential-backoff (not mocked) with fake timers, so these
// tests assert the actual wait between attempts.

const config: Config = {
  key: "deepseek.chat.v1",
  provider: "deepseek.chat",
  endpoint: "",
  method: "POST",
  headers: "{}",
  options: {},
  mapBody: {},
};

function providerError(retryAfterMs?: number) {
  return new LlmExeError("Service unavailable", {
    code: "llm.provider_unavailable",
    context: {
      status: 503,
      providerError: { status: 503, retryable: true, retryAfterMs },
    },
  } as any);
}

/**
 * Handler that fails `failures` times and then succeeds, recording the
 * fake-clock time of each attempt.
 */
function flakyHandler(failures: number, error: () => Error) {
  const times: number[] = [];
  const handler = jest.fn(async () => {
    times.push(Date.now());
    if (times.length <= failures) throw error();
    return { ok: true };
  });
  return { handler, times };
}

function gaps(times: number[]) {
  return times.slice(1).map((t, i) => t - times[i]);
}

describe("apiRequestWrapper retry backoff", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("waits before retrying with the default options", async () => {
    const { handler, times } = flakyHandler(1, () => new Error("500"));
    const llm = apiRequestWrapper(config, {}, handler);
    const p = llm.call("hi");

    await jest.advanceTimersByTimeAsync(499);
    expect(handler).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toEqual({ ok: true });
    expect(gaps(times)).toEqual([500]);
  });

  it("backs off exponentially, capped at maxDelay", async () => {
    const { handler, times } = flakyHandler(4, () => new Error("500"));
    const llm = apiRequestWrapper(
      config,
      { numOfAttempts: 5, maxDelay: 1500 },
      handler
    );
    const p = llm.call("hi");
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toEqual({ ok: true });
    expect(gaps(times)).toEqual([500, 1000, 1500, 1500]);
  });

  it("caps the starting delay at a small maxDelay, and maxDelay 0 means no wait", async () => {
    const small = flakyHandler(1, () => new Error("500"));
    const p1 = apiRequestWrapper(config, { maxDelay: 50 }, small.handler).call(
      "hi"
    );
    await jest.advanceTimersByTimeAsync(1000);
    await p1;
    expect(gaps(small.times)).toEqual([50]);

    const none = flakyHandler(1, () => new Error("500"));
    const p2 = apiRequestWrapper(config, { maxDelay: 0 }, none.handler).call(
      "hi"
    );
    await jest.advanceTimersByTimeAsync(0);
    await p2;
    expect(gaps(none.times)).toEqual([0]);
  });

  it("honors the provider's retry-after, capped at maxDelay", async () => {
    const honored = flakyHandler(1, () => providerError(2000));
    const p1 = apiRequestWrapper(config, {}, honored.handler).call("hi");
    await jest.advanceTimersByTimeAsync(10_000);
    await p1;
    expect(gaps(honored.times)).toEqual([2000]);

    const capped = flakyHandler(1, () => providerError(120_000));
    const p2 = apiRequestWrapper(
      config,
      { maxDelay: 3000 },
      capped.handler
    ).call("hi");
    await jest.advanceTimersByTimeAsync(10_000);
    await p2;
    expect(gaps(capped.times)).toEqual([3000]);
  });

  it("uses the backoff delay when retry-after is shorter", async () => {
    const { handler, times } = flakyHandler(1, () => providerError(100));
    const p = apiRequestWrapper(config, {}, handler).call("hi");
    await jest.advanceTimersByTimeAsync(10_000);
    await p;
    expect(gaps(times)).toEqual([500]);
  });

  it("does not wait for retry-after after the final attempt", async () => {
    const { handler } = flakyHandler(5, () => providerError(5000));
    const p = apiRequestWrapper(config, { numOfAttempts: 1 }, handler).call(
      "hi"
    );
    const assertion = expect(p).rejects.toThrow("Service unavailable");
    await jest.advanceTimersByTimeAsync(0);
    await assertion;
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
