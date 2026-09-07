import { createClient } from "@libsql/client";
import { ValidationPipe } from "@nestjs/common";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { DatabaseService } from "@app/database";
import { CreateGiftcardDto } from "../dto/create-giftcard.dto";

describe("minimal spending schema", () => {
  let databasePath: string;
  let database: DatabaseService;

  beforeEach(async () => {
    databasePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "giftcards-schema-")),
      "app.db",
    );
    process.env.DATABASE_URL = `file:${databasePath}`;
    database = new DatabaseService();
    await database.onModuleInit();
  });

  afterEach(() => {
    database.close();
    delete process.env.DATABASE_URL;
  });

  it("creates integer-cent giftcards and the indexed spends log", async () => {
    const client = createClient({ url: `file:${databasePath}` });
    await client.execute("PRAGMA foreign_keys = ON");
    const giftcardInfo = await client.execute("PRAGMA table_info(giftcards)");
    const spendsInfo = await client.execute("PRAGMA table_info(spendsLog)");
    const indexes = await client.execute("PRAGMA index_list(spendsLog)");

    expect(giftcardInfo.rows.find((row) => row[1] === "amount")?.[2]).toBe(
      "INTEGER",
    );
    expect(spendsInfo.rows.map((row) => row[1])).toEqual([
      "id",
      "giftcardId",
      "amount",
      "createdAt",
    ]);
    expect(
      indexes.rows.some((row) => row[1] === "spendsLog_giftcardId_idx"),
    ).toBe(true);
    await expect(
      client.execute({
        sql: "INSERT INTO giftcards (amount, description, storeId, receriverEmail) VALUES (?, ?, ?, ?)",
        args: [12.5, "fractional", "store-1", "receiver@example.com"],
      }),
    ).rejects.toThrow();
    await client.execute({
      sql: "INSERT INTO giftcards (amount, description, storeId, receriverEmail) VALUES (?, ?, ?, ?)",
      args: [1000, "valid", "store-1", "receiver@example.com"],
    });
    await expect(
      client.execute({
        sql: "INSERT INTO spendsLog (giftcardId, amount) VALUES (?, ?)",
        args: [1, 1.5],
      }),
    ).rejects.toThrow();
    await expect(
      client.execute({
        sql: "INSERT INTO spendsLog (giftcardId, amount) VALUES (?, ?)",
        args: [999, 100],
      }),
    ).rejects.toThrow();
    client.close();
  });

  it("keeps startup idempotent", async () => {
    await expect(database.onModuleInit()).resolves.toBeUndefined();
  });

  it("serializes concurrent startup against a legacy database", async () => {
    database.close();
    const client = createClient({ url: `file:${databasePath}` });
    await client.execute("DROP TABLE spendsLog");
    await client.execute("DROP TABLE giftcards");
    await client.execute(
      "CREATE TABLE giftcards (id INTEGER PRIMARY KEY, amount REAL NOT NULL, description TEXT, expiresAt TEXT, storeId TEXT, receriverEmail TEXT, createdAt TEXT, updatedAt TEXT)",
    );
    await client.execute({
      sql: "INSERT INTO giftcards VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        1,
        10.0,
        "legacy",
        null,
        "store-1",
        "receiver@example.com",
        null,
        null,
      ],
    });
    client.close();

    const first = new DatabaseService();
    const second = new DatabaseService();
    await expect(
      Promise.all([first.onModuleInit(), second.onModuleInit()]),
    ).resolves.toHaveLength(2);
    second.close();
    database = first;
  }, 30000);

  it("rejects fractional DTO amounts at the validation boundary", async () => {
    const pipe = new ValidationPipe({ transform: true });

    await expect(
      pipe.transform(
        {
          amount: 12.5,
          description: "gift",
          expiresAt: "2026-10-01T00:00:00.000Z",
          storeId: "store-1",
          receriverEmail: "receiver@example.com",
        },
        { type: "body", metatype: CreateGiftcardDto, data: "" },
      ),
    ).rejects.toThrow();
  });

  it("converts representative legacy decimal data without losing fields", async () => {
    database.close();
    const client = createClient({ url: `file:${databasePath}` });
    await client.execute("DROP TABLE spendsLog");
    await client.execute("DROP TABLE giftcards");
    await client.execute(`
      CREATE TABLE giftcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        description TEXT,
        expiresAt TEXT,
        storeId TEXT,
        receriverEmail TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.execute({
      sql: "INSERT INTO giftcards (amount, description, storeId, receriverEmail) VALUES (?, ?, ?, ?)",
      args: [12.34, "legacy", "store-1", "receiver@example.com"],
    });
    await client.execute(`
      CREATE TABLE spendsLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giftcardId INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        createdAt TEXT,
        FOREIGN KEY (giftcardId) REFERENCES giftcards(id) ON DELETE CASCADE
      )
    `);
    await client.execute({
      sql: "INSERT INTO spendsLog (giftcardId, amount, createdAt) VALUES (?, ?, ?)",
      args: [1, 250, "2026-09-07T00:00:00.000Z"],
    });
    client.close();

    database = new DatabaseService();
    await database.onModuleInit();
    const rowsClient = createClient({ url: `file:${databasePath}` });
    const rows = await rowsClient.execute(
      "SELECT amount, description, storeId, receriverEmail FROM giftcards",
    );

    expect(rows.rows).toEqual([
      {
        amount: 1234,
        description: "legacy",
        storeId: "store-1",
        receriverEmail: "receiver@example.com",
      },
    ]);
    rowsClient.close();

    const migratedClient = createClient({ url: `file:${databasePath}` });
    await migratedClient.execute("PRAGMA foreign_keys = ON");
    const migratedSpends = await migratedClient.execute(
      "SELECT giftcardId, amount FROM spendsLog",
    );
    expect(migratedSpends.rows).toEqual([{ giftcardId: 1, amount: 250 }]);
    await migratedClient.execute("DELETE FROM giftcards WHERE id = 1");
    const afterCascade = await migratedClient.execute(
      "SELECT COUNT(*) AS count FROM spendsLog",
    );
    expect(afterCascade.rows).toEqual([{ count: 0 }]);
    migratedClient.close();
  });

  it("rejects invalid legacy amounts and leaves the original table intact", async () => {
    database.close();
    const client = createClient({ url: `file:${databasePath}` });
    await client.execute("DROP TABLE giftcards");
    await client.execute(
      "CREATE TABLE giftcards (id INTEGER PRIMARY KEY, amount REAL NOT NULL, description TEXT, storeId TEXT, receriverEmail TEXT)",
    );
    await client.execute({
      sql: "INSERT INTO giftcards VALUES (?, ?, ?, ?, ?)",
      args: [1, -1, "invalid", "store-1", "receiver@example.com"],
    });
    client.close();

    database = new DatabaseService();
    await expect(database.onModuleInit()).rejects.toThrow(
      "invalid legacy amount",
    );

    const verificationClient = createClient({ url: `file:${databasePath}` });
    const tableInfo = await verificationClient.execute(
      "PRAGMA table_info(giftcards)",
    );
    const rows = await verificationClient.execute(
      "SELECT amount FROM giftcards",
    );
    expect(tableInfo.rows.find((row) => row[1] === "amount")?.[2]).toBe("REAL");
    expect(rows.rows).toEqual([{ amount: -1 }]);
    verificationClient.close();
  });

  it("fails fast on an unsupported weak INTEGER schema", async () => {
    database.close();
    const client = createClient({ url: `file:${databasePath}` });
    await client.execute("DROP TABLE spendsLog");
    await client.execute("DROP TABLE giftcards");
    await client.execute(
      "CREATE TABLE giftcards (id INTEGER PRIMARY KEY, amount INTEGER NOT NULL, description TEXT, expiresAt TEXT, storeId TEXT, receriverEmail TEXT, createdAt TEXT, updatedAt TEXT)",
    );
    await client.execute(
      "CREATE TABLE spendsLog (id INTEGER PRIMARY KEY, giftcardId INTEGER NOT NULL, amount INTEGER NOT NULL, createdAt TEXT)",
    );
    client.close();

    database = new DatabaseService();
    await expect(database.onModuleInit()).rejects.toThrow(
      "database schema does not enforce integer cents",
    );
  });
});
