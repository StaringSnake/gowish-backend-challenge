import { Module } from "@nestjs/common";
import { GiftcardsController } from "./giftcards.controller";
import { GiftcardsService } from "./giftcards.service";

@Module({
  controllers: [GiftcardsController],
  providers: [GiftcardsService],
  exports: [GiftcardsService],
})
export class GiftcardsModule {}
