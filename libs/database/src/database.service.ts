import { Injectable, OnModuleInit } from "@nestjs/common";
import { drizzle } from "drizzle-orm/libsql";
import { Client, createClient } from "@libsql/client";

import * as giftcards from "apps/giftcards/src/giftcards/entities/giftcard.schema";
import * as stores from "apps/stores/src/stores/entities/store.schema";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class DatabaseService implements OnModuleInit {
  private sqlite: Client;
  public db: ReturnType<typeof drizzle>;

  constructor() {
    const dataDir = path.dirname(process.env.DATABASE_URL || "./data/app.db");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const client = createClient({
      url: process.env.DATABASE_URL || "file:./data/app.db",
    });

    this.sqlite = client;

    this.db = drizzle(client, { schema: { ...giftcards, ...stores } });
  }

  async onModuleInit() {
    // Create tables if they don't exist
    await this.sqlite.execute(`
      CREATE TABLE IF NOT EXISTS giftcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        description TEXT,
        expiresAt TEXT,
        storeId TEXT,
        receriverEmail TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

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

    console.log("Database initialized");
  }

  getDb() {
    return this.db;
  }

  close() {
    this.sqlite.close();
  }
}
