import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { DatabaseService } from "@app/database";
import { stores } from "./entities/store.schema";
import { Store } from "./entities/store.entity";
import { CreateStoreDto } from "./dto/create-store.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

@Injectable()
export class StoresService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    const id = randomUUID();
    const [store] = await this.databaseService.db
      .insert(stores)
      .values({
        id,
        ...createStoreDto,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return store;
  }

  async findAll(): Promise<Store[]> {
    return this.databaseService.db.select().from(stores);
  }

  async findOne(id: string): Promise<Store> {
    const [store] = await this.databaseService.db
      .select()
      .from(stores)
      .where(eq(stores.id, id));

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }
    return store;
  }

  async update(id: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    await this.findOne(id); // Check if store exists

    const [store] = await this.databaseService.db
      .update(stores)
      .set({
        ...updateStoreDto,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(stores.id, id))
      .returning();

    return store;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Check if store exists

    await this.databaseService.db.delete(stores).where(eq(stores.id, id));
  }
}
