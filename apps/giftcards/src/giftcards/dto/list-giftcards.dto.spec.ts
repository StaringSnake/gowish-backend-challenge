import { ValidationPipe } from "@nestjs/common";
import { ListGiftcardsDto } from "./list-giftcards.dto";

describe("ListGiftcardsDto", () => {
  const pipe = new ValidationPipe({ transform: true });

  it("transforms valid query strings and applies defaults", async () => {
    await expect(
      pipe.transform(
        { userEmail: "receiver@example.com" },
        { type: "query", metatype: ListGiftcardsDto, data: "" },
      ),
    ).resolves.toMatchObject({
      userEmail: "receiver@example.com",
      page: 1,
      limit: 20,
    });
  });

  it("applies defaults when pagination fields are omitted", async () => {
    await expect(
      pipe.transform(
        {},
        { type: "query", metatype: ListGiftcardsDto, data: "" },
      ),
    ).resolves.toMatchObject({ page: 1, limit: 20 });
  });

  it.each([{ page: null }, { limit: null }])(
    "rejects explicit null pagination values: %j",
    async (query) => {
      await expect(
        pipe.transform(query, {
          type: "query",
          metatype: ListGiftcardsDto,
          data: "",
        }),
      ).rejects.toThrow();
    },
  );

  it.each([
    { page: "0" },
    { page: "1.5" },
    { page: "not-a-number" },
    { limit: "0" },
    { limit: "101" },
    { limit: "1.5" },
    { userEmail: "x".repeat(321) },
    { page: "0x10" },
    { page: "1e2" },
    { page: ["1"] },
    { limit: { value: "1" } },
  ])("rejects invalid query values: %j", async (query) => {
    await expect(
      pipe.transform(query, {
        type: "query",
        metatype: ListGiftcardsDto,
        data: "",
      }),
    ).rejects.toThrow();
  });
});
