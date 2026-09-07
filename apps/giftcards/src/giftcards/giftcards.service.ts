import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { DatabaseService } from "@app/database";
import { giftcards } from "./entities/giftcard.schema";
import { Giftcard } from "./entities/giftcard.entity";
import { CreateGiftcardDto } from "./dto/create-giftcard.dto";
import { spendsLog } from "./entities/spends-log.schema";

export type GiftcardResponse = Giftcard & { currentAmount: number };

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
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    createGiftcardDto: CreateGiftcardDto,
  ): Promise<GiftcardResponse> {
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

  async findAll(): Promise<GiftcardResponse[]> {
    return this.databaseService.db
      .select({
        ...giftcardFields,
      })
      .from(giftcards);
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

  async findByUserEmail(userEmail: string): Promise<GiftcardResponse[]> {
    return this.databaseService.db
      .select({
        ...giftcardFields,
      })
      .from(giftcards)
      .where(eq(giftcards.receriverEmail, userEmail))
      .orderBy(desc(giftcards.createdAt), desc(giftcards.id));
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
