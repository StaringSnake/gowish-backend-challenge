import { ValidationPipe } from "@nestjs/common";
import { CreateGiftcardDto } from "./create-giftcard.dto";

describe("CreateGiftcardDto", () => {
  const pipe = new ValidationPipe({ transform: true });
  const request = (storeId: string) => ({
    amount: 1000,
    description: "Gift",
    expiresAt: "2026-10-01T00:00:00.000Z",
    storeId,
    receriverEmail: "receiver@example.com",
  });

  it.each([128, 129])("handles a %i-character store ID", async (length) => {
    const validation = pipe.transform(request("x".repeat(length)), {
      type: "body",
      metatype: CreateGiftcardDto,
      data: "",
    });

    if (length === 128) {
      await expect(validation).resolves.toBeInstanceOf(CreateGiftcardDto);
    } else {
      await expect(validation).rejects.toThrow();
    }
  });
});
