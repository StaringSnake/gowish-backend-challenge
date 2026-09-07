import { Test, TestingModule } from "@nestjs/testing";
import { GiftcardsModule } from "./giftcards.module";
import { GiftcardsController } from "./giftcards.controller";
import { GiftcardsService } from "./giftcards.service";
import { DatabaseModule, DatabaseService } from "@app/database";
import { STORES_CLIENT } from "./store-validation.client";

describe("GiftcardsModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    const mockDatabaseService = {
      db: {
        insert: jest.fn().mockResolvedValue([{}]),
        select: jest.fn().mockResolvedValue([{}]),
        delete: jest.fn().mockResolvedValue([{}]),
        update: jest.fn().mockResolvedValue([{}]),
      },
      onModuleInit: jest.fn(),
      close: jest.fn(),
    };

    module = await Test.createTestingModule({
      imports: [GiftcardsModule, DatabaseModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDatabaseService)
      .overrideProvider(STORES_CLIENT)
      .useValue({ verifyStore: jest.fn() })
      .compile();
  });

  it("should be defined", () => {
    expect(module).toBeDefined();
  });

  it("should have GiftcardsController", () => {
    const controller = module.get<GiftcardsController>(GiftcardsController);
    expect(controller).toBeDefined();
  });

  it("should have GiftcardsService", () => {
    const service = module.get<GiftcardsService>(GiftcardsService);
    expect(service).toBeDefined();
  });
});
