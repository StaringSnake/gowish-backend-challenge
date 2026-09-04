import { Module } from "@nestjs/common";
import { DatabaseModule } from "@app/database";
import { GiftcardsModule } from "./giftcards";

@Module({
  imports: [DatabaseModule, GiftcardsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
