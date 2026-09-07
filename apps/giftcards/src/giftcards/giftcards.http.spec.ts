import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { DatabaseService } from "@app/database";
import { AppModule } from "../app.module";
import { giftcards } from "./entities/giftcard.schema";

describe("Giftcards summary HTTP", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let baseUrl: string;

  beforeAll(async () => {
    const databasePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "giftcards-summary-http-")),
      "app.db",
    );
    process.env.DATABASE_URL = `file:${databasePath}`;
    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix("api");
    await app.listen(0);
    baseUrl = await app.getUrl();
    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
    database.close();
    delete process.env.DATABASE_URL;
  });

  it("resolves the static route and safely serializes a special store key", async () => {
    await database.db.insert(giftcards).values({
      amount: 100,
      description: "Special key",
      storeId: "__proto__",
      receriverEmail: "http@example.com",
      expiresAt: null,
    });

    const response = await fetch(`${baseUrl}/api/giftcards/summary`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      totalExpiredCards: 0,
      totalActiveCards: 1,
    });
    expect(
      Object.prototype.hasOwnProperty.call(body.byStore, "__proto__"),
    ).toBe(true);
    expect(body.byStore["__proto__"]).toEqual({
      totalAmountCents: 100,
      totalExpiredCards: 0,
      totalActiveCards: 1,
    });
  });

  it("maps an invalid persisted expiration to HTTP 400", async () => {
    await database.db.insert(giftcards).values({
      amount: 100,
      description: "Invalid timestamp",
      storeId: "store-1",
      receriverEmail: "http@example.com",
      expiresAt: "not-a-timestamp",
    });

    const response = await fetch(`${baseUrl}/api/giftcards/summary`);

    expect(response.status).toBe(400);
  });
});
