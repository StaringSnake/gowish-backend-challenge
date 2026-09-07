import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const giftcards = sqliteTable(
  "giftcards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: text("storeId").notNull(),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    receriverEmail: text("receriverEmail").notNull(),
    expiresAt: text("expiresAt"),
    createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    normalizedCreatedAtIdIndex: index(
      "giftcards_createdAt_normalized_id_idx",
    ).on(
      sql`datetime(${table.createdAt}) IS NULL ASC`,
      sql`datetime(${table.createdAt}) DESC`,
      sql`${table.id} DESC`,
    ),
    emailNormalizedCreatedAtIdIndex: index(
      "giftcards_email_createdAt_normalized_id_idx",
    ).on(
      table.receriverEmail,
      sql`datetime(${table.createdAt}) IS NULL ASC`,
      sql`datetime(${table.createdAt}) DESC`,
      sql`${table.id} DESC`,
    ),
  }),
);

export type Giftcard = typeof giftcards.$inferSelect;
export type InsertGiftcard = typeof giftcards.$inferInsert;
