import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { GiftcardsService } from "./giftcards.service";
import { CreateGiftcardDto } from "./dto/create-giftcard.dto";
import { SpendGiftcardDto } from "./dto/spend-giftcard.dto";
import { ListGiftcardsDto } from "./dto/list-giftcards.dto";

const giftcardSchema = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    amount: {
      type: "integer",
      description: "Issued amount in cents",
      example: 5000,
    },
    currentAmount: {
      type: "integer",
      description: "Remaining amount in cents",
      example: 3500,
    },
    description: { type: "string", example: "Birthday gift" },
    storeId: { type: "string", example: "store-1" },
    receriverEmail: { type: "string", example: "receiver@example.com" },
    expiresAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time", nullable: true },
    updatedAt: { type: "string", format: "date-time", nullable: true },
  },
};

@Controller("giftcards")
@ApiTags("Giftcards")
export class GiftcardsController {
  constructor(private readonly giftcardsService: GiftcardsService) {}

  @Post()
  @ApiOperation({ summary: "Create a giftcard" })
  @ApiResponse({
    status: 201,
    description: "Giftcard created.",
    schema: giftcardSchema,
  })
  @ApiResponse({ status: 400, description: "Unknown store or invalid input." })
  @ApiResponse({ status: 503, description: "Stores service is unavailable." })
  create(@Body() createGiftcardDto: CreateGiftcardDto) {
    return this.giftcardsService.create(createGiftcardDto);
  }

  @Get()
  @ApiOperation({ summary: "List giftcards with pagination" })
  @ApiResponse({
    status: 200,
    description:
      "Paginated giftcards with total/page/limit/totalPages metadata.",
    schema: {
      type: "object",
      properties: {
        data: { type: "array", items: giftcardSchema },
        meta: {
          type: "object",
          properties: {
            total: { type: "integer", example: 42 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", maximum: 100, example: 20 },
            totalPages: { type: "integer", example: 3 },
          },
        },
      },
    },
  })
  findAll(@Query() query: ListGiftcardsDto) {
    return this.giftcardsService.findAll(query);
  }

  @Get("summary")
  @ApiOperation({ summary: "Summarize giftcards by active state and store" })
  @ApiResponse({
    status: 200,
    description:
      "Active and expired counts plus remaining integer-cent balances by store.",
    schema: {
      type: "object",
      properties: {
        totalExpiredCards: { type: "integer", example: 2 },
        totalActiveCards: { type: "integer", example: 8 },
        byStore: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              totalAmountCents: { type: "integer", example: 330050 },
              totalExpiredCards: { type: "integer", example: 1 },
              totalActiveCards: { type: "integer", example: 4 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Persisted expiration data is invalid.",
  })
  summary() {
    return this.giftcardsService.summary();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a giftcard" })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: "Giftcard including currentAmount in integer cents.",
    schema: giftcardSchema,
  })
  @ApiResponse({ status: 404, description: "Giftcard not found." })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.giftcardsService.findOne(id);
  }

  @Post(":id/spend")
  @ApiOperation({ summary: "Spend part of a giftcard" })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiBody({ type: SpendGiftcardDto })
  @ApiResponse({
    status: 201,
    description: "Updated giftcard after recording the spend.",
    schema: giftcardSchema,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid, expired, or over-balance spend.",
  })
  @ApiResponse({ status: 404, description: "Giftcard not found." })
  spend(
    @Param("id", ParseIntPipe) id: number,
    @Body() spendGiftcardDto: SpendGiftcardDto,
  ) {
    return this.giftcardsService.spend(id, spendGiftcardDto.amount);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a giftcard" })
  @ApiParam({ name: "id", type: Number, example: 1 })
  @ApiResponse({ status: 200, description: "Giftcard deleted." })
  @ApiResponse({ status: 404, description: "Giftcard not found." })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.giftcardsService.remove(id);
  }
}
