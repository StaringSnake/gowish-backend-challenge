import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

export const giftcards = sqliteTable("giftcards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("storeId").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  receriverEmail: text("receriverEmail").notNull(),
  expiresAt: text("expiresAt"),
  createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt").default(sql`CURRENT_TIMESTAMP`),
});

export type Giftcard = typeof giftcards.$inferSelect;
export type InsertGiftcard = typeof giftcards.$inferInsert;
