import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { giftcards } from "./giftcard.schema";

export const spendsLog = sqliteTable(
  "spendsLog",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    giftcardId: integer("giftcardId")
      .notNull()
      .references(() => giftcards.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: text("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    giftcardIdIndex: index("spendsLog_giftcardId_idx").on(table.giftcardId),
  }),
);

export type SpendLog = typeof spendsLog.$inferSelect;
export type InsertSpendLog = typeof spendsLog.$inferInsert;
