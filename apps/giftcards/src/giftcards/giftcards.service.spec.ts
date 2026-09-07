import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { DatabaseService } from "@app/database";
import { GiftcardsService } from "./giftcards.service";
import { CreateGiftcardDto } from "./dto/create-giftcard.dto";
import { SpendGiftcardDto } from "./dto/spend-giftcard.dto";
import { giftcards } from "./entities/giftcard.schema";
import { spendsLog } from "./entities/spends-log.schema";
import {
  StoreNotFoundError,
  StoreServiceUnavailableError,
  StoreValidationClient,
} from "./store-validation.client";

describe("GiftcardsService spending", () => {
  let database: DatabaseService;
  let service: GiftcardsService;
  let storesClient: jest.Mocked<StoreValidationClient>;

  beforeEach(async () => {
    const databasePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "giftcards-spending-")),
      "app.db",
    );
    process.env.DATABASE_URL = `file:${databasePath}`;
    database = new DatabaseService();
    await database.onModuleInit();
    storesClient = { verifyStore: jest.fn().mockResolvedValue(undefined) };
    service = new GiftcardsService(database, storesClient);
  });

  afterEach(() => {
    database.close();
    delete process.env.DATABASE_URL;
  });

  async function createGiftcard(
    amount: number,
    expiresAt: string | null = null,
  ): Promise<number> {
    const [giftcard] = await database.db
      .insert(giftcards)
      .values({
        amount,
        description: "Gift",
        storeId: "store-1",
        receriverEmail: "receiver@example.com",
        expiresAt,
      })
      .returning({ id: giftcards.id });
    return giftcard.id;
  }

  it("accepts a partial spend and returns the remaining balance", async () => {
    const id = await createGiftcard(1000);

    await expect(service.spend(id, 250)).resolves.toMatchObject({
      id,
      amount: 1000,
      currentAmount: 750,
    });
    await expect(service.findOne(id)).resolves.toMatchObject({
      currentAmount: 750,
    });
    await expect(database.db.select().from(spendsLog)).resolves.toHaveLength(1);
  });

  it("includes the remaining balance when creating a giftcard", async () => {
    const created = await service.create({
      amount: 1000,
      description: "Gift",
      storeId: "store-1",
      receriverEmail: "receiver@example.com",
      expiresAt: "2026-10-01T00:00:00.000Z",
    } satisfies CreateGiftcardDto);

    expect(created).toMatchObject({ amount: 1000, currentAmount: 1000 });
    expect(storesClient.verifyStore).toHaveBeenCalledWith("store-1");
  });

  it("rejects an unknown store without writing a giftcard", async () => {
    storesClient.verifyStore.mockRejectedValue(new StoreNotFoundError());

    await expect(
      service.create({
        amount: 1000,
        description: "Gift",
        storeId: "missing",
        receriverEmail: "receiver@example.com",
        expiresAt: "2026-10-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(database.db.select().from(giftcards)).resolves.toHaveLength(0);
  });

  it("rejects an unavailable Stores service without writing a giftcard", async () => {
    storesClient.verifyStore.mockRejectedValue(
      new StoreServiceUnavailableError(),
    );

    await expect(
      service.create({
        amount: 1000,
        description: "Gift",
        storeId: "store-1",
        receriverEmail: "receiver@example.com",
        expiresAt: "2026-10-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(database.db.select().from(giftcards)).resolves.toHaveLength(0);
  });

  it("includes the remaining balance in list and email-filtered responses", async () => {
    const id = await createGiftcard(1000);
    await service.spend(id, 250);

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({ id, currentAmount: 750 }),
    ]);
    await expect(
      service.findByUserEmail("receiver@example.com"),
    ).resolves.toEqual([expect.objectContaining({ id, currentAmount: 750 })]);
  });

  it("rejects an overspend without creating a log", async () => {
    const id = await createGiftcard(1000);

    await expect(service.spend(id, 1001)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await database.db.select().from(spendsLog)).toHaveLength(0);
  });

  it("rejects missing and expired giftcards without creating logs", async () => {
    const expiredId = await createGiftcard(1000, "2026-09-06T00:00:00.000Z");

    await expect(service.spend(999, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.spend(expiredId, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await database.db.select().from(spendsLog)).toHaveLength(0);
  });

  it("rejects a persisted invalid expiration without creating a log", async () => {
    const id = await createGiftcard(1000, "not-a-timestamp");

    await expect(service.spend(id, 1)).rejects.toMatchObject({
      status: 400,
    });
    expect(await database.db.select().from(spendsLog)).toHaveLength(0);
  });

  it("serializes concurrent spends so the balance never becomes negative", async () => {
    const id = await createGiftcard(1000);

    const results = await Promise.allSettled([
      service.spend(id, 700),
      service.spend(id, 700),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(service.findOne(id)).resolves.toMatchObject({
      currentAmount: 300,
    });
    await expect(database.db.select().from(spendsLog)).resolves.toHaveLength(1);
  });

  it("rejects non-positive and fractional spend amounts at the validation boundary", async () => {
    const pipe = new ValidationPipe({ transform: true });

    await expect(
      pipe.transform(
        { amount: 0 },
        { type: "body", metatype: SpendGiftcardDto, data: "" },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { amount: 1.5 },
        { type: "body", metatype: SpendGiftcardDto, data: "" },
      ),
    ).rejects.toThrow();
  });
});
