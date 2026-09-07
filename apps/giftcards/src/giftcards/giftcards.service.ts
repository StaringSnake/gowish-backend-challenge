import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Inject,
} from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { DatabaseService } from "@app/database";
import { giftcards } from "./entities/giftcard.schema";
import { Giftcard } from "./entities/giftcard.entity";
import { CreateGiftcardDto } from "./dto/create-giftcard.dto";
import { ListGiftcardsDto } from "./dto/list-giftcards.dto";
import { spendsLog } from "./entities/spends-log.schema";
import {
  StoreNotFoundError,
  StoreServiceUnavailableError,
  STORES_CLIENT,
  StoreValidationClient,
} from "./store-validation.client";

export type GiftcardResponse = Giftcard & { currentAmount: number };
export type GiftcardListResponse = {
  data: GiftcardResponse[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};
export type GiftcardSummary = {
  totalExpiredCards: number;
  totalActiveCards: number;
  byStore: Record<
    string,
    {
      totalAmountCents: number;
      totalExpiredCards: number;
      totalActiveCards: number;
    }
  >;
};

const giftcardFields = {
  id: giftcards.id,
  amount: giftcards.amount,
  description: giftcards.description,
  storeId: giftcards.storeId,
  receriverEmail: giftcards.receriverEmail,
  expiresAt: giftcards.expiresAt,
  createdAt: giftcards.createdAt,
  updatedAt: giftcards.updatedAt,
  currentAmount: sql<number>`
    ${giftcards.amount} - coalesce(
      (select sum(${spendsLog.amount}) from ${spendsLog}
       where ${spendsLog.giftcardId} = ${giftcards.id}), 0
    )
  `,
};

@Injectable()
export class GiftcardsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(STORES_CLIENT)
    private readonly storesClient: StoreValidationClient,
  ) {}

  async create(
    createGiftcardDto: CreateGiftcardDto,
  ): Promise<GiftcardResponse> {
    try {
      await this.storesClient.verifyStore(createGiftcardDto.storeId);
    } catch (error) {
      if (error instanceof StoreNotFoundError) {
        throw new BadRequestException("storeId references an unknown store");
      }
      if (error instanceof StoreServiceUnavailableError) {
        throw new ServiceUnavailableException("Stores service is unavailable");
      }
      throw new ServiceUnavailableException("Stores service is unavailable");
    }

    const [createdGiftcard] = await this.databaseService.db
      .insert(giftcards)
      .values({
        ...createGiftcardDto,
        expiresAt: createGiftcardDto.expiresAt
          ? createGiftcardDto.expiresAt
          : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return this.findOne(createdGiftcard.id);
  }

  async findAll(
    query: ListGiftcardsDto = new ListGiftcardsDto(),
  ): Promise<GiftcardListResponse> {
    const filter = query.userEmail
      ? eq(giftcards.receriverEmail, query.userEmail)
      : undefined;
    const offset = (query.page - 1) * query.limit;

    return this.databaseService.db.transaction(async (tx) => {
      const rows = await tx
        .select(giftcardFields)
        .from(giftcards)
        .where(filter)
        .orderBy(
          sql`(datetime(${giftcards.createdAt}) IS NULL) ASC`,
          sql`datetime(${giftcards.createdAt}) DESC`,
          desc(giftcards.id),
        )
        .limit(query.limit)
        .offset(offset);
      const [{ total }] = await tx
        .select({ total: sql<number>`count(*)` })
        .from(giftcards)
        .where(filter);

      return {
        data: rows,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    });
  }

  async findOne(id: number): Promise<GiftcardResponse> {
    const [giftcard] = await this.databaseService.db
      .select(giftcardFields)
      .from(giftcards)
      .where(eq(giftcards.id, id));

    if (!giftcard) {
      throw new NotFoundException(`Giftcard with ID ${id} not found`);
    }
    return giftcard;
  }

  async summary(evaluationTime = new Date()): Promise<GiftcardSummary> {
    let rows;
    try {
      const spendTotals = this.databaseService.db
        .select({
          giftcardId: spendsLog.giftcardId,
          spent: sql<number>`sum(${spendsLog.amount})`.as("spent"),
        })
        .from(spendsLog)
        .groupBy(spendsLog.giftcardId)
        .as("spend_totals");
      rows = await this.databaseService.db
        .select({
          storeId: giftcards.storeId,
          totalAmountCents: sql<number>`sum(
            ${giftcards.amount} - coalesce(${spendTotals.spent}, 0)
          )`,
          maxSpentCents: sql<number>`coalesce(max(${spendTotals.spent}), 0)`,
          totalExpiredCards: sql<number>`sum(
            case when ${giftcards.expiresAt} is not null
              and julianday(${giftcards.expiresAt}) is not null
              and julianday(${giftcards.expiresAt}) < julianday(${evaluationTime.toISOString()})
            then 1 else 0 end
          )`,
          totalActiveCards: sql<number>`sum(
            case when ${giftcards.expiresAt} is null
              or julianday(${giftcards.expiresAt}) >= julianday(${evaluationTime.toISOString()})
            then 1 else 0 end
          )`,
          invalidExpirationCount: sql<number>`sum(
            case when ${giftcards.expiresAt} is not null
              and julianday(${giftcards.expiresAt}) is null
            then 1 else 0 end
          )`,
        })
        .from(giftcards)
        .leftJoin(spendTotals, eq(giftcards.id, spendTotals.giftcardId))
        .groupBy(giftcards.storeId);
    } catch {
      throw new InternalServerErrorException(
        "Giftcard summary cannot be represented safely",
      );
    }

    if (rows.some((row) => row.invalidExpirationCount > 0)) {
      throw new BadRequestException("Giftcard expiration is invalid");
    }

    const byStore = Object.create(null) as GiftcardSummary["byStore"];
    let totalExpiredCards = 0;
    let totalActiveCards = 0;
    for (const row of rows) {
      if (
        !Number.isSafeInteger(row.totalAmountCents) ||
        row.totalAmountCents < 0 ||
        !Number.isSafeInteger(row.maxSpentCents) ||
        row.maxSpentCents < 0 ||
        !Number.isSafeInteger(row.totalExpiredCards) ||
        row.totalExpiredCards < 0 ||
        !Number.isSafeInteger(row.totalActiveCards) ||
        row.totalActiveCards < 0 ||
        !Number.isSafeInteger(row.invalidExpirationCount) ||
        row.invalidExpirationCount < 0
      ) {
        throw new InternalServerErrorException(
          "Giftcard summary cannot be represented safely",
        );
      }
      byStore[row.storeId] = {
        totalAmountCents: row.totalAmountCents,
        totalExpiredCards: row.totalExpiredCards,
        totalActiveCards: row.totalActiveCards,
      };
      totalExpiredCards += row.totalExpiredCards;
      totalActiveCards += row.totalActiveCards;
      if (
        !Number.isSafeInteger(totalExpiredCards) ||
        !Number.isSafeInteger(totalActiveCards)
      ) {
        throw new InternalServerErrorException(
          "Giftcard summary cannot be represented safely",
        );
      }
    }

    return {
      totalExpiredCards,
      totalActiveCards,
      byStore,
    };
  }

  async spend(id: number, amount: number): Promise<GiftcardResponse> {
    return this.databaseService.db.transaction(async (tx) => {
      const evaluationTime = new Date();
      const [giftcard] = await tx
        .select({ id: giftcards.id, expiresAt: giftcards.expiresAt })
        .from(giftcards)
        .where(eq(giftcards.id, id));

      if (!giftcard) {
        throw new NotFoundException(`Giftcard with ID ${id} not found`);
      }
      const expirationTime = giftcard.expiresAt
        ? Date.parse(giftcard.expiresAt)
        : null;
      if (expirationTime !== null && Number.isNaN(expirationTime)) {
        throw new BadRequestException("Giftcard expiration is invalid");
      }
      if (
        expirationTime !== null &&
        expirationTime < evaluationTime.getTime()
      ) {
        throw new BadRequestException("Expired giftcards cannot be spent");
      }

      // The conditional update takes the write lock before the balance check.
      // Therefore another spend cannot pass this check with the same balance.
      const [reserved] = await tx
        .update(giftcards)
        .set({ updatedAt: evaluationTime.toISOString() })
        .where(
          and(
            eq(giftcards.id, id),
            sql`${giftcards.amount} - coalesce(
              (select sum(${spendsLog.amount}) from ${spendsLog}
               where ${spendsLog.giftcardId} = ${giftcards.id}), 0
            ) >= ${amount}`,
          ),
        )
        .returning({ id: giftcards.id });

      if (!reserved) {
        throw new BadRequestException("Spend amount exceeds current balance");
      }

      await tx.insert(spendsLog).values({
        giftcardId: id,
        amount,
        createdAt: evaluationTime.toISOString(),
      });

      const [updatedGiftcard] = await tx
        .select(giftcardFields)
        .from(giftcards)
        .where(eq(giftcards.id, id));
      if (!updatedGiftcard) {
        throw new InternalServerErrorException(
          "Giftcard disappeared during spend",
        );
      }
      return updatedGiftcard;
    });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // Check if giftcard exists

    await this.databaseService.db.delete(giftcards).where(eq(giftcards.id, id));
  }
}
