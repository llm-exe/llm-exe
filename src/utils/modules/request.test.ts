import { apiRequest } from "@/utils/modules/request";

const fetchMock = jest.fn();

jest.mock('node:fetch', () => ({
  __esModule: true,
  default: fetchMock
}));

const originalFetch = global.fetch;
Object.defineProperty(global, 'fetch', {
  configurable: true,
  get: () => fetchMock
});

afterAll(() => {
  Object.defineProperty(global, "fetch", {
    configurable: true,
    get: () => originalFetch,
  });
});

describe("apiRequest", () => {
  const url = "https://api.example.com/data";
  const dummyData = { key: "value" };

  const jsonMock = jest.fn();
  const textMock = jest.fn();
  const globalFetch = fetchMock as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock.mockResolvedValue(dummyData);
    textMock.mockResolvedValue("Some error message");
  });
  it("should make error early without a url", async () => {
    await expect(apiRequest("")).rejects.toThrow(`Invalid URL`);
  });
  it("should make error early without a valid url", async () => {
    await expect(apiRequest("not-a-url")).rejects.toThrow(`Invalid URL`);
  });
  it("should make a request and return the data", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    const { data } = await apiRequest<typeof dummyData>(url);
    expect(data).toEqual(dummyData);
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("returns response headers alongside the data, with lowercased keys", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      headers: new Headers({
        "content-type": "application/json",
        "X-Amzn-Bedrock-Input-Token-Count": "5",
      }),
    } as unknown as Response);

    const { data, headers } = await apiRequest<typeof dummyData>(url);
    expect(data).toEqual(dummyData);
    expect(headers).toEqual(
      expect.objectContaining({ "x-amzn-bedrock-input-token-count": "5" })
    );
  });

  it("should make a request and return the data as text according to headers ", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      text: textMock,
      headers: new Headers({
        "content-type": "application/x-ndjson", // not json
      }),
    } as unknown as Response);
    const mockJsonl = JSON.stringify({ testing: "jsonl" });
    textMock.mockResolvedValue(mockJsonl);
    const { data } = await apiRequest<typeof dummyData>(url);
    expect(data).toEqual(mockJsonl);
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("should handle HTTP errors correctly", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: textMock,
      json: jest.fn(),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 404. Error Message: Some error message`
    );
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("falls back to default message when response body is empty", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: jest.fn().mockResolvedValue(""),
      json: jest.fn(),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status: 500. Error Message: Internal Server Error`
    );
  });

  it("falls back to raw text when response body is not JSON", async () => {
    const rawText = "plain text error from upstream";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue(rawText),
      json: jest.fn(),
      headers: new Headers({
        "content-type": "text/plain",
      }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 502. Error Message: ${rawText}`
    );
  });

  it("should throw a generic error if the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("Fetch failed"));

    await expect(apiRequest(url)).rejects.toThrow(
      "Request to https://api.example.com/data failed: Fetch failed"
    );
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });


  it("extracts the error.message field from a JSON error body", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({ error: { message: "No further details provided." } })
        ),
      json: jest.fn(),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    const oaiUrl = `https://api.openai.com/something`;

    await expect(apiRequest(oaiUrl)).rejects.toThrow(
      `Request to ${oaiUrl} failed: HTTP error. Status Code: 404. Error Message: No further details provided.`
    );
  });
  

  it("extracts the error string from body.error when it is a string", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ error: "Forbidden by policy" })),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 403. Error Message: Forbidden by policy`
    );
  });

  it("extracts body.message when body.error is absent", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ message: "Validation failed" })),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 422. Error Message: Validation failed`
    );
  });

  it("JSON-stringifies detail when it resolves to a non-string value", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({ error: { code: "BAD_REQUEST", details: [1, 2] } })
        ),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 400. Error Message: {"code":"BAD_REQUEST","details":[1,2]}`
    );
  });

  it("falls back to raw text when JSON body has no error or message fields", async () => {
    const rawJson = JSON.stringify({ code: 123, info: "unexpected shape" });
    globalFetch.mockResolvedValue({
      ok: false,
      status: 418,
      text: jest.fn().mockResolvedValue(rawJson),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status Code: 418. Error Message: ${rawJson}`
    );
  });

  it("falls back to default message when text() itself throws", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: jest.fn().mockRejectedValue(new Error("stream consumed")),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status: 503. Error Message: Service Unavailable`
    );
  });

  it("falls back to 'Unknown error.' when statusText is empty", async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "",
      text: jest.fn().mockRejectedValue(new Error("unreadable")),
      json: jest.fn(),
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response);

    await expect(apiRequest(url)).rejects.toThrow(
      `Request to ${url} failed: HTTP error. Status: 500. Error Message: Unknown error.`
    );
  });

  it("should handle null responses correctly", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(null),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    const { data } = await apiRequest<null>(url);
    expect(data).toBe(null);
    expect(fetchMock).toHaveBeenCalledWith(url, {});
  });

  it("should accept and merge custom request options", async () => {
    const customOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: jsonMock,
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as unknown as Response);

    await apiRequest(url, customOptions);
    expect(fetchMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

});