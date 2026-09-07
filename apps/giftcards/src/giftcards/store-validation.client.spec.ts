import {
  StoreNotFoundError,
  StoreServiceUnavailableError,
  StoresClient,
} from "./store-validation.client";
import { MAX_STORE_ID_LENGTH } from "./giftcards.constants";

describe("StoresClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.STORES_SERVICE_URL;
    jest.useRealTimers();
  });

  it("confirms a store from the Stores response", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "store-1" }), { status: 200 }),
      );

    await expect(
      new StoresClient().verifyStore("store-1"),
    ).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/api/stores/store-1" }),
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("encodes delimiter-containing store IDs and normalizes the base URL", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "store/a?b#c" }), { status: 200 }),
      );
    process.env.STORES_SERVICE_URL =
      "http://localhost:3001///?ignored=yes#fragment";

    await new StoresClient().verifyStore("store/a?b#c");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "http://localhost:3001/api/stores/store%2Fa%3Fb%23c",
      }),
      expect.any(Object),
    );
  });

  it("translates a Stores 404 into a missing-store failure", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));

    await expect(
      new StoresClient().verifyStore("missing"),
    ).rejects.toBeInstanceOf(StoreNotFoundError);
  });

  it.each([
    ["an unexpected status", new Response(null, { status: 500 })],
    ["a malformed response", new Response("not-json", { status: 200 })],
  ])("translates %s into an unavailable failure", async (_name, response) => {
    globalThis.fetch = jest.fn().mockResolvedValue(response);

    await expect(
      new StoresClient().verifyStore("store-1"),
    ).rejects.toBeInstanceOf(StoreServiceUnavailableError);
  });

  it("rejects a response whose store ID does not match", async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "other-store" }), { status: 200 }),
      );

    await expect(
      new StoresClient().verifyStore("store-1"),
    ).rejects.toBeInstanceOf(StoreServiceUnavailableError);
  });

  it("rejects an oversized response using Content-Length", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "store-1" }), {
        status: 200,
        headers: { "content-length": String(16 * 1024 + 1) },
      }),
    );

    await expect(
      new StoresClient().verifyStore("store-1"),
    ).rejects.toBeInstanceOf(StoreServiceUnavailableError);
  });

  it("rejects an oversized streamed response and cancels its reader", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16 * 1024));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() {
        cancelled = true;
      },
    });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(new Response(stream, { status: 200 }));

    await expect(
      new StoresClient().verifyStore("store-1"),
    ).rejects.toBeInstanceOf(StoreServiceUnavailableError);
    expect(cancelled).toBe(true);
  });

  it("aborts a request that exceeds the timeout", async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest
      .fn()
      .mockImplementation((_url: URL, init: RequestInit) => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const abort = () => controller.error(new Error("aborted"));
            if (init.signal?.aborted) {
              abort();
            } else {
              init.signal?.addEventListener("abort", abort);
            }
          },
        });
        return Promise.resolve(new Response(stream, { status: 200 }));
      });

    const result = new StoresClient().verifyStore("store-1");
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(2_000);

    await expect(result).rejects.toBeInstanceOf(StoreServiceUnavailableError);
  });

  it("fails closed when fetch rejects a redirect", async () => {
    globalThis.fetch = jest
      .fn()
      .mockImplementation((_url, init: RequestInit) => {
        expect(init.redirect).toBe("error");
        return Promise.reject(new Error("redirect rejected"));
      });

    await expect(
      new StoresClient().verifyStore("store-1"),
    ).rejects.toBeInstanceOf(StoreServiceUnavailableError);
  });

  it("rejects an oversized store ID at the client boundary", async () => {
    globalThis.fetch = jest.fn();

    await expect(
      new StoresClient().verifyStore("x".repeat(MAX_STORE_ID_LENGTH + 1)),
    ).rejects.toBeInstanceOf(StoreServiceUnavailableError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
