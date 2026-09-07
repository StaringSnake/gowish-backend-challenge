import { Injectable, OnModuleInit } from "@nestjs/common";
import { drizzle } from "drizzle-orm/libsql";
import { Client, createClient } from "@libsql/client";

import * as giftcards from "apps/giftcards/src/giftcards/entities/giftcard.schema";
import * as spendsLog from "apps/giftcards/src/giftcards/entities/spends-log.schema";
import * as stores from "apps/stores/src/stores/entities/store.schema";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class DatabaseService implements OnModuleInit {
  private static readonly schemaInitializationByUrl = new Map<
    string,
    Promise<void>
  >();
  private readonly databaseUrl: string;
  private sqlite: Client;
  public db: ReturnType<typeof drizzle>;

  constructor() {
    this.databaseUrl = process.env.DATABASE_URL || "file:./data/app.db";
    const dataDir = path.dirname(this.databaseUrl);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const client = createClient({
      url: this.databaseUrl,
    });

    this.sqlite = client;

    this.db = drizzle(client, {
      schema: { ...giftcards, ...spendsLog, ...stores },
    });
  }

  async onModuleInit() {
    await this.sqlite.execute("PRAGMA foreign_keys = ON;");
    await this.sqlite.execute("PRAGMA busy_timeout = 5000;");

    const previousInitialization =
      DatabaseService.schemaInitializationByUrl.get(this.databaseUrl) ??
      Promise.resolve();
    const initialization = (async () => {
      await previousInitialization;
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          await this.initializeSchemaOnce();
          console.log("Database initialized");
          return;
        } catch (error) {
          const isBusy =
            error instanceof Error && error.message.includes("SQLITE_BUSY");
          if (!isBusy || attempt === maxAttempts - 1) {
            throw error;
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 50 * (attempt + 1));
          });
        }
      }
    })();
    const storedInitialization = initialization.catch(() => undefined);
    DatabaseService.schemaInitializationByUrl.set(
      this.databaseUrl,
      storedInitialization,
    );
    try {
      await initialization;
    } finally {
      if (
        DatabaseService.schemaInitializationByUrl.get(this.databaseUrl) ===
        storedInitialization
      ) {
        DatabaseService.schemaInitializationByUrl.delete(this.databaseUrl);
      }
    }
  }

  private async initializeSchemaOnce(): Promise<void> {
    await this.sqlite.execute("BEGIN IMMEDIATE;");
    try {
      await this.sqlite.execute(`
        CREATE TABLE IF NOT EXISTS giftcards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount INTEGER NOT NULL CHECK (
            typeof(amount) = 'integer' AND amount > 0 AND amount <= 9007199254740991
          ),
          description TEXT,
          expiresAt TEXT,
          storeId TEXT,
          receriverEmail TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.migrateGiftcardAmountsToCents();

      await this.sqlite.execute(`
        CREATE TABLE IF NOT EXISTS stores (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          countryCode TEXT(2) NOT NULL,
          address TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.sqlite.execute(`
        CREATE TABLE IF NOT EXISTS spendsLog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          giftcardId INTEGER NOT NULL,
          amount INTEGER NOT NULL CHECK (
            typeof(amount) = 'integer' AND amount > 0 AND amount <= 9007199254740991
          ),
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (giftcardId) REFERENCES giftcards(id) ON DELETE CASCADE
        );
      `);

      await this.sqlite.execute(`
        CREATE INDEX IF NOT EXISTS spendsLog_giftcardId_idx
        ON spendsLog(giftcardId);
      `);

      await this.sqlite.execute(`
        CREATE INDEX IF NOT EXISTS giftcards_createdAt_normalized_id_idx
        ON giftcards (
          datetime(createdAt) IS NULL ASC,
          datetime(createdAt) DESC,
          id DESC
        );
      `);
      await this.sqlite.execute(`
        CREATE INDEX IF NOT EXISTS giftcards_email_createdAt_normalized_id_idx
        ON giftcards (
          receriverEmail,
          datetime(createdAt) IS NULL ASC,
          datetime(createdAt) DESC,
          id DESC
        );
      `);

      await this.assertIntegerSchemaIntegrity();

      await this.sqlite.execute("COMMIT;");
    } catch (error) {
      await this.sqlite.execute("ROLLBACK;");
      throw error;
    }
  }

  private async migrateGiftcardAmountsToCents(): Promise<void> {
    const tableInfo = await this.sqlite.execute(
      "PRAGMA table_info(giftcards);",
    );
    const amountColumn = tableInfo.rows.find((row) => row[1] === "amount");

    if (!amountColumn || amountColumn[2] !== "REAL") {
      return;
    }

    const spendsLog = await this.sqlite.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'spendsLog';",
    );
    const hasSpendsLog = spendsLog.rows.length > 0;
    const invalidLegacyAmounts = await this.sqlite.execute(`
        SELECT COUNT(*) AS invalid
        FROM giftcards
        WHERE amount IS NULL
          OR typeof(amount) NOT IN ('real', 'integer')
          OR amount <= 0
          OR amount > 90071992547409.91
          OR CAST(ROUND(amount * 100) AS INTEGER) <= 0
          OR CAST(ROUND(amount * 100) AS INTEGER) > 9007199254740991;
      `);
    if (invalidLegacyAmounts.rows[0]?.invalid !== 0) {
      throw new Error("giftcards contains an invalid legacy amount");
    }

    if (hasSpendsLog) {
      await this.sqlite.execute(
        "DROP INDEX IF EXISTS spendsLog_giftcardId_idx;",
      );
      await this.sqlite.execute(
        "ALTER TABLE spendsLog RENAME TO spendsLog_legacy;",
      );
    }
    await this.sqlite.execute(
      "ALTER TABLE giftcards RENAME TO giftcards_legacy;",
    );
    await this.sqlite.execute(`
        CREATE TABLE giftcards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount INTEGER NOT NULL CHECK (
            typeof(amount) = 'integer' AND amount > 0 AND amount <= 9007199254740991
          ),
          description TEXT,
          expiresAt TEXT,
          storeId TEXT,
          receriverEmail TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    await this.sqlite.execute(`
        INSERT INTO giftcards
          (id, amount, description, expiresAt, storeId, receriverEmail, createdAt, updatedAt)
        SELECT
          id, CAST(ROUND(amount * 100) AS INTEGER), description, expiresAt,
          storeId, receriverEmail, createdAt, updatedAt
        FROM giftcards_legacy;
      `);
    if (hasSpendsLog) {
      await this.sqlite.execute(`
          CREATE TABLE spendsLog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giftcardId INTEGER NOT NULL,
            amount INTEGER NOT NULL CHECK (
              typeof(amount) = 'integer' AND amount > 0 AND amount <= 9007199254740991
            ),
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (giftcardId) REFERENCES giftcards(id) ON DELETE CASCADE
          );
        `);
      await this.sqlite.execute(`
          INSERT INTO spendsLog (id, giftcardId, amount, createdAt)
          SELECT id, giftcardId, amount, createdAt FROM spendsLog_legacy;
        `);
      await this.sqlite.execute("DROP TABLE spendsLog_legacy;");
    }
    await this.sqlite.execute("DROP TABLE giftcards_legacy;");
    if (hasSpendsLog) {
      await this.sqlite.execute(
        "CREATE INDEX spendsLog_giftcardId_idx ON spendsLog(giftcardId);",
      );
    }
  }

  private async assertIntegerSchemaIntegrity(): Promise<void> {
    const giftcardDefinition = await this.sqlite.execute(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'giftcards';",
    );
    const spendsDefinition = await this.sqlite.execute(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'spendsLog';",
    );
    const giftcardSql = giftcardDefinition.rows[0]?.sql;
    const spendsSql = spendsDefinition.rows[0]?.sql;
    if (
      typeof giftcardSql !== "string" ||
      !giftcardSql.toLowerCase().includes("typeof(amount) = 'integer'") ||
      typeof spendsSql !== "string" ||
      !spendsSql.toLowerCase().includes("typeof(amount) = 'integer'")
    ) {
      throw new Error("database schema does not enforce integer cents");
    }

    const foreignKeys = await this.sqlite.execute(
      "PRAGMA foreign_key_list(spendsLog);",
    );
    const giftcardForeignKey = foreignKeys.rows.find(
      (row) => row[2] === "giftcards" && row[3] === "giftcardId",
    );
    if (!giftcardForeignKey || giftcardForeignKey[6] !== "CASCADE") {
      throw new Error("spendsLog schema does not enforce giftcard cascade");
    }
  }

  getDb() {
    return this.db;
  }

  close() {
    this.sqlite.close();
  }
}
