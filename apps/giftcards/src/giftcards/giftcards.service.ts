import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@app/database";
import { giftcards } from "./entities/giftcard.schema";
import { Giftcard } from "./entities/giftcard.entity";
import { CreateGiftcardDto } from "./dto/create-giftcard.dto";

@Injectable()
export class GiftcardsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createGiftcardDto: CreateGiftcardDto): Promise<Giftcard> {
    const [giftcard] = await this.databaseService.db
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
    return giftcard;
  }

  async findAll(): Promise<Giftcard[]> {
    return this.databaseService.db
      .select({
        id: giftcards.id,
        amount: giftcards.amount,
        description: giftcards.description,
        storeId: giftcards.storeId,
        receriverEmail: giftcards.receriverEmail,
        expiresAt: giftcards.expiresAt,
        createdAt: giftcards.createdAt,
        updatedAt: giftcards.updatedAt,
      })
      .from(giftcards);
  }

  async findOne(id: number): Promise<Giftcard> {
    const [giftcard] = await this.databaseService.db
      .select({
        id: giftcards.id,
        amount: giftcards.amount,
        description: giftcards.description,
        storeId: giftcards.storeId,
        receriverEmail: giftcards.receriverEmail,
        expiresAt: giftcards.expiresAt,
        createdAt: giftcards.createdAt,
        updatedAt: giftcards.updatedAt,
      })
      .from(giftcards)
      .where(eq(giftcards.id, id));

    if (!giftcard) {
      throw new NotFoundException(`Giftcard with ID ${id} not found`);
    }
    return giftcard;
  }

  async findByUserEmail(userEmail: string): Promise<Giftcard[]> {
    return this.databaseService.db
      .select({
        id: giftcards.id,
        amount: giftcards.amount,
        description: giftcards.description,
        storeId: giftcards.storeId,
        receriverEmail: giftcards.receriverEmail,
        expiresAt: giftcards.expiresAt,
        createdAt: giftcards.createdAt,
        updatedAt: giftcards.updatedAt,
      })
      .from(giftcards)
      .where(eq(giftcards.receriverEmail, userEmail));
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // Check if giftcard exists

    await this.databaseService.db.delete(giftcards).where(eq(giftcards.id, id));
  }
}
