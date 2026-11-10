import { loadConfigFromUrl } from "./fromUrl";

function fakeResponse(body: string, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: "OK",
    text: async () => body,
  } as Response;
}

describe("loadConfigFromUrl", () => {
  it("uses the injected fetch and infers format from the URL extension", async () => {
    const yaml = "provider: openai.chat-mock.v1\nmessage: hi\n";
    const fetchImpl = jest.fn(async () => fakeResponse(yaml));

    const result = await loadConfigFromUrl("https://x.com/config.yml", {
      fetch: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("openai.chat-mock.v1");
    expect(result.message).toBe("hi");
  });

  it("never hits the real network (no fetch call is left to the global)", async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse('{"provider":"openai.chat-mock.v1","message":"hi"}')
    );
    await loadConfigFromUrl("https://x.com/c.json", {
      fetch: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://x.com/c.json", undefined);
  });

  it("throws request.http_error on a non-ok response", async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse("nope", { ok: false, status: 404 })
    );
    await expect(
      loadConfigFromUrl("https://x.com/c.json", {
        fetch: fetchImpl as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "request.http_error" });
  });

  it("honors an explicit format over the extension", async () => {
    const fetchImpl = jest.fn(async () =>
      fakeResponse('{"provider":"openai.chat-mock.v1","message":"hi"}')
    );
    const result = await loadConfigFromUrl("https://x.com/config.unknown", {
      fetch: fetchImpl as unknown as typeof fetch,
      format: "json",
    });
    expect(result.message).toBe("hi");
  });
});
