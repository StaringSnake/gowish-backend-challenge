import { Module } from "@nestjs/common";
import { GiftcardsController } from "./giftcards.controller";
import { GiftcardsService } from "./giftcards.service";
import { STORES_CLIENT, StoresClient } from "./store-validation.client";

@Module({
  controllers: [GiftcardsController],
  providers: [
    GiftcardsService,
    StoresClient,
    { provide: STORES_CLIENT, useExisting: StoresClient },
  ],
  exports: [GiftcardsService],
})
export class GiftcardsModule {}
