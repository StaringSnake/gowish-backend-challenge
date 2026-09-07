import { ValidationPipe, INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { DatabaseService } from "@app/database";
import { AppModule as GiftcardsAppModule } from "../app.module";
import { AppModule as StoresAppModule } from "../../../stores/src/app.module";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalStoresServiceUrl = process.env.STORES_SERVICE_URL;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringProperty(value: unknown, property: string): string {
  if (
    !isJsonObject(value) ||
    !(property in value) ||
    typeof value[property] !== "string"
  ) {
    throw new Error(`Expected JSON string property: ${property}`);
  }
  return value[property];
}

function getNumberProperty(value: unknown, property: string): number {
  if (
    !isJsonObject(value) ||
    !(property in value) ||
    typeof value[property] !== "number"
  ) {
    throw new Error(`Expected JSON number property: ${property}`);
  }
  return value[property];
}

async function jsonRequest(
  baseUrl: string,
  route: string,
  options: RequestInit = {},
): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  return { response, body: await response.json() };
}

describe("live Stores and Giftcards HTTP integration", () => {
  let storesApp: INestApplication | undefined;
  let giftcardsApp: INestApplication | undefined;
  let giftcardsDatabase: DatabaseService | undefined;
  let storesDatabase: DatabaseService | undefined;
  let storesBaseUrl = "";
  let giftcardsBaseUrl = "";
  let databaseDirectory = "";
  let storesClosed = false;

  async function closeResources(): Promise<void> {
    if (giftcardsApp) {
      await giftcardsApp.close();
      giftcardsApp = undefined;
    }
    if (storesApp && !storesClosed) {
      await storesApp.close();
      storesApp = undefined;
      storesClosed = true;
    }
    giftcardsDatabase?.close();
    storesDatabase?.close();
    giftcardsDatabase = undefined;
    storesDatabase = undefined;
    if (databaseDirectory) {
      await fs.promises.rm(databaseDirectory, { recursive: true, force: true });
      databaseDirectory = "";
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    if (originalStoresServiceUrl === undefined) {
      delete process.env.STORES_SERVICE_URL;
    } else {
      process.env.STORES_SERVICE_URL = originalStoresServiceUrl;
    }
  }

  beforeAll(async () => {
    try {
      databaseDirectory = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), "live-stores-giftcards-"),
      );
      process.env.DATABASE_URL = `file:${path.join(databaseDirectory, "app.db")}`;

      storesApp = await NestFactory.create(StoresAppModule);
      storesApp.useGlobalPipes(new ValidationPipe());
      storesApp.setGlobalPrefix("api");
      await storesApp.listen(0);
      storesBaseUrl = await storesApp.getUrl();
      storesDatabase = storesApp.get(DatabaseService);

      process.env.STORES_SERVICE_URL = storesBaseUrl;
      giftcardsApp = await NestFactory.create(GiftcardsAppModule);
      giftcardsApp.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      giftcardsApp.enableCors();
      giftcardsApp.setGlobalPrefix("api");
      await giftcardsApp.listen(0);
      giftcardsBaseUrl = await giftcardsApp.getUrl();
      giftcardsDatabase = giftcardsApp.get(DatabaseService);
    } catch (error) {
      await closeResources();
      throw error;
    }
  });

  afterAll(async () => {
    await closeResources();
  });

  it("creates, spends, lists, and summarizes a giftcard through both live HTTP services", async () => {
    const storeResult = await jsonRequest(`${storesBaseUrl}`, "/api/stores", {
      method: "POST",
      body: JSON.stringify({
        name: "Integration Store",
        countryCode: "BR",
        address: "1 Integration Street",
      }),
    });
    expect(storeResult.response.status).toBe(201);
    const storeId = getStringProperty(storeResult.body, "id");

    const giftcardResult = await jsonRequest(
      `${giftcardsBaseUrl}`,
      "/api/giftcards",
      {
        method: "POST",
        body: JSON.stringify({
          amount: 10000,
          description: "Live integration giftcard",
          expiresAt: "2099-01-01T00:00:00.000Z",
          storeId,
          receriverEmail: "live-integration@example.com",
          ignored: "whitelisted out",
        }),
      },
    );
    expect(giftcardResult.response.status).toBe(201);
    const giftcardId = getNumberProperty(giftcardResult.body, "id");
    expect(giftcardResult.body).toMatchObject({
      amount: 10000,
      currentAmount: 10000,
    });

    const spendResult = await jsonRequest(
      `${giftcardsBaseUrl}`,
      `/api/giftcards/${giftcardId}/spend`,
      { method: "POST", body: JSON.stringify({ amount: 2500 }) },
    );
    expect(spendResult.response.status).toBe(201);
    expect(spendResult.body).toMatchObject({
      id: giftcardId,
      currentAmount: 7500,
    });

    const listResult = await jsonRequest(
      `${giftcardsBaseUrl}`,
      "/api/giftcards?page=1&limit=1",
    );
    expect(listResult.response.status).toBe(200);
    expect(listResult.body).toMatchObject({
      meta: { total: 1, page: 1, limit: 1, totalPages: 1 },
      data: [expect.objectContaining({ id: giftcardId, currentAmount: 7500 })],
    });

    const summaryResult = await jsonRequest(
      `${giftcardsBaseUrl}`,
      "/api/giftcards/summary",
    );
    expect(summaryResult.response.status).toBe(200);
    expect(summaryResult.body).toMatchObject({
      totalExpiredCards: 0,
      totalActiveCards: 1,
      byStore: {
        [storeId]: {
          totalAmountCents: 7500,
          totalExpiredCards: 0,
          totalActiveCards: 1,
        },
      },
    });
  });

  it("rejects an unknown store without persisting a giftcard", async () => {
    const result = await jsonRequest(`${giftcardsBaseUrl}`, "/api/giftcards", {
      method: "POST",
      body: JSON.stringify({
        amount: 1000,
        description: "Should not persist",
        expiresAt: "2099-01-01T00:00:00.000Z",
        storeId: "store-that-does-not-exist",
        receriverEmail: "unknown-store@example.com",
      }),
    });
    expect(result.response.status).toBe(400);

    const listResult = await jsonRequest(
      `${giftcardsBaseUrl}`,
      "/api/giftcards?userEmail=unknown-store%40example.com",
    );
    expect(listResult.response.status).toBe(200);
    expect(listResult.body).toMatchObject({
      data: [],
      meta: { total: 0 },
    });
  });

  it("maps Stores unavailability to 503 without persisting a giftcard", async () => {
    if (!storesApp || !storesDatabase) {
      throw new Error("Stores app was not initialized");
    }
    await storesApp.close();
    storesApp = undefined;
    storesClosed = true;
    storesDatabase.close();
    storesDatabase = undefined;

    const result = await jsonRequest(`${giftcardsBaseUrl}`, "/api/giftcards", {
      method: "POST",
      body: JSON.stringify({
        amount: 1000,
        description: "Stores unavailable",
        expiresAt: "2099-01-01T00:00:00.000Z",
        storeId: "any-store-id",
        receriverEmail: "stores-unavailable@example.com",
      }),
    });
    expect(result.response.status).toBe(503);

    const listResult = await jsonRequest(
      `${giftcardsBaseUrl}`,
      "/api/giftcards?userEmail=stores-unavailable%40example.com",
    );
    expect(listResult.response.status).toBe(200);
    expect(listResult.body).toMatchObject({ data: [], meta: { total: 0 } });
  });
});
