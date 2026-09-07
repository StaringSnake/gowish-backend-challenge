import { Injectable } from "@nestjs/common";
import { MAX_STORE_ID_LENGTH } from "./giftcards.constants";

export class StoreNotFoundError extends Error {}

export class StoreServiceUnavailableError extends Error {}

export interface StoreValidationClient {
  verifyStore(storeId: string): Promise<void>;
}

export const STORES_CLIENT = Symbol("STORES_CLIENT");

type StoreResponse = { id: string };

const DEFAULT_STORES_SERVICE_URL = "http://localhost:3001";
const STORES_REQUEST_TIMEOUT_MS = 2_000;
const MAX_STORE_RESPONSE_BYTES = 16 * 1024;

@Injectable()
export class StoresClient implements StoreValidationClient {
  async verifyStore(storeId: string): Promise<void> {
    if (storeId.length > MAX_STORE_ID_LENGTH) {
      throw new StoreServiceUnavailableError();
    }

    const baseUrl =
      process.env.STORES_SERVICE_URL ?? DEFAULT_STORES_SERVICE_URL;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      STORES_REQUEST_TIMEOUT_MS,
    );

    try {
      let url: URL;
      try {
        url = new URL(baseUrl);
        url.search = "";
        url.hash = "";
        url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/stores/${encodeURIComponent(storeId)}`;
      } catch {
        throw new StoreServiceUnavailableError();
      }

      let response: Response;
      try {
        response = await fetch(url, {
          redirect: "error",
          signal: controller.signal,
        });
      } catch {
        throw new StoreServiceUnavailableError();
      }

      if (response.status === 404) {
        throw new StoreNotFoundError();
      }
      if (!response.ok) {
        throw new StoreServiceUnavailableError();
      }

      let body: unknown;
      try {
        const contentLength = response.headers.get("content-length");
        if (
          contentLength !== null &&
          (!/^\d+$/.test(contentLength) ||
            Number(contentLength) > MAX_STORE_RESPONSE_BYTES)
        ) {
          throw new StoreServiceUnavailableError();
        }
        body = JSON.parse(await readResponseText(response));
      } catch {
        throw new StoreServiceUnavailableError();
      }
      if (!isStoreResponse(body) || body.id !== storeId) {
        throw new StoreServiceUnavailableError();
      }
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
}

async function readResponseText(response: Response): Promise<string> {
  if (!response.body) {
    throw new StoreServiceUnavailableError();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_STORE_RESPONSE_BYTES) {
        await reader.cancel();
        throw new StoreServiceUnavailableError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isStoreResponse(value: unknown): value is StoreResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  );
}
