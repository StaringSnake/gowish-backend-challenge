import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { sql } from "drizzle-orm";

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
    createdAt?: string,
  ): Promise<number> {
    const [giftcard] = await database.db
      .insert(giftcards)
      .values({
        amount,
        description: "Gift",
        storeId: "store-1",
        receriverEmail: "receiver@example.com",
        expiresAt,
        ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
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

  it("includes the remaining balance in paginated list responses", async () => {
    const id = await createGiftcard(1000);
    await service.spend(id, 250);

    await expect(service.findAll()).resolves.toEqual({
      data: [expect.objectContaining({ id, currentAmount: 750 })],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    await expect(
      service.findAll({
        userEmail: "receiver@example.com",
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      data: [expect.objectContaining({ id, currentAmount: 750 })],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it("filters before pagination and orders newest cards first", async () => {
    const firstId = await createGiftcard(
      1000,
      null,
      "2026-09-07T00:00:00.000Z",
    );
    const otherId = await database.db
      .insert(giftcards)
      .values({
        amount: 2000,
        description: "Other",
        storeId: "store-1",
        receriverEmail: "other@example.com",
        createdAt: "2026-09-07 23:00:00",
        updatedAt: "2026-09-07 23:00:00",
      })
      .returning({ id: giftcards.id })
      .then(([giftcard]) => giftcard.id);
    const newestId = await createGiftcard(
      3000,
      null,
      "2026-09-07T23:00:00.000Z",
    );

    await expect(service.findAll({ page: 1, limit: 1 })).resolves.toMatchObject(
      {
        data: [expect.objectContaining({ id: newestId })],
        meta: { total: 3, totalPages: 3 },
      },
    );
    await expect(
      service.findAll({ userEmail: "receiver@example.com", page: 1, limit: 1 }),
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ id: newestId })],
      meta: { total: 2, totalPages: 2 },
    });
    expect(firstId).not.toBe(otherId);
  });

  it("normalizes mixed timestamp formats and uses id descending for equal times", async () => {
    const olderId = await createGiftcard(1000, null, "2026-09-07 23:00:00");
    const equalTimestampId = await createGiftcard(
      2000,
      null,
      "2026-09-07T23:00:00.000Z",
    );

    await expect(service.findAll({ page: 1, limit: 2 })).resolves.toMatchObject(
      {
        data: [
          expect.objectContaining({ id: equalTimestampId }),
          expect.objectContaining({ id: olderId }),
        ],
      },
    );
  });

  function planDetails(plan: unknown[]): string[] {
    return plan.flatMap((row) =>
      typeof row === "object" && row !== null && "detail" in row
        ? [String(row.detail)]
        : [],
    );
  }

  it("uses the filtered normalized-order index without a temp sort", async () => {
    const plan = await database.getDb()
      .all(sql`EXPLAIN QUERY PLAN SELECT id FROM giftcards
        WHERE receriverEmail = ${"receiver@example.com"}
        ORDER BY (datetime(createdAt) IS NULL) ASC,
          datetime(createdAt) DESC, id DESC LIMIT 1`);
    const details = planDetails(plan);

    expect(details.join(" ")).toContain(
      "giftcards_email_createdAt_normalized_id_idx",
    );
    expect(details.join(" ")).not.toContain("USE TEMP B-TREE FOR ORDER BY");
  });

  it("uses the unfiltered normalized-order index without a temp sort", async () => {
    const plan = await database.getDb()
      .all(sql`EXPLAIN QUERY PLAN SELECT id FROM giftcards
        ORDER BY (datetime(createdAt) IS NULL) ASC,
          datetime(createdAt) DESC, id DESC LIMIT 1`);
    const details = planDetails(plan);

    expect(details.join(" ")).toContain(
      "giftcards_createdAt_normalized_id_idx",
    );
    expect(details.join(" ")).not.toContain("USE TEMP B-TREE FOR ORDER BY");
  });

  it("returns empty data for an out-of-range page with accurate metadata", async () => {
    await createGiftcard(1000);

    await expect(service.findAll({ page: 2, limit: 1 })).resolves.toEqual({
      data: [],
      meta: { total: 1, page: 2, limit: 1, totalPages: 1 },
    });
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

  it("returns an empty summary when there are no giftcards", async () => {
    await expect(service.summary()).resolves.toEqual({
      totalExpiredCards: 0,
      totalActiveCards: 0,
      byStore: {},
    });
  });

  it("aggregates remaining balances and expiration counts by store", async () => {
    const expiredId = await createGiftcard(1000, "2020-01-01T00:00:00.000Z");
    await database.db.insert(giftcards).values({
      amount: 2500,
      description: "Active",
      storeId: "store-2",
      receriverEmail: "active@example.com",
      expiresAt: "2999-01-01T00:00:00.000Z",
    });
    await database.db.insert(giftcards).values({
      amount: 500,
      description: "Never expires",
      storeId: "store-1",
      receriverEmail: "never@example.com",
      expiresAt: null,
    });
    await database.db.insert(spendsLog).values({
      giftcardId: expiredId,
      amount: 300,
    });

    await expect(service.summary()).resolves.toEqual({
      totalExpiredCards: 1,
      totalActiveCards: 2,
      byStore: {
        "store-1": {
          totalAmountCents: 1200,
          totalExpiredCards: 1,
          totalActiveCards: 1,
        },
        "store-2": {
          totalAmountCents: 2500,
          totalExpiredCards: 0,
          totalActiveCards: 1,
        },
      },
    });
  });

  it("rejects invalid persisted expiration timestamps", async () => {
    await createGiftcard(1000, "not-a-timestamp");

    await expect(service.summary()).rejects.toMatchObject({ status: 400 });
  });

  it("serializes a persisted __proto__ store id as an ordinary response key", async () => {
    await database.db.insert(giftcards).values({
      amount: 100,
      description: "Special key",
      storeId: "__proto__",
      receriverEmail: "special@example.com",
      expiresAt: null,
    });

    const summary = await service.summary();

    expect(
      Object.prototype.hasOwnProperty.call(summary.byStore, "__proto__"),
    ).toBe(true);
    expect(JSON.parse(JSON.stringify(summary)).byStore["__proto__"]).toEqual({
      totalAmountCents: 100,
      totalExpiredCards: 0,
      totalActiveCards: 1,
    });
  });

  it("treats an expiration equal to the evaluation time as active", async () => {
    const evaluationTime = new Date("2030-01-01T00:00:00.000Z");
    await createGiftcard(1000, evaluationTime.toISOString());

    await expect(service.summary(evaluationTime)).resolves.toMatchObject({
      totalExpiredCards: 0,
      totalActiveCards: 1,
    });
  });

  it("rejects a per-store total that exceeds safe integer precision", async () => {
    await createGiftcard(Number.MAX_SAFE_INTEGER);
    await createGiftcard(Number.MAX_SAFE_INTEGER);

    await expect(service.summary()).rejects.toMatchObject({ status: 500 });
  });

  it("maps aggregate query failures to a stable 500 without database details", async () => {
    const selectSpy = jest
      .spyOn(database.db, "select")
      .mockImplementation(() => {
        throw new Error("SQLITE integer overflow: internal database detail");
      });

    try {
      await expect(service.summary()).rejects.toMatchObject({
        status: 500,
        response: {
          statusCode: 500,
          message: "Giftcard summary cannot be represented safely",
        },
      });
    } finally {
      selectSpy.mockRestore();
    }
  });
});
