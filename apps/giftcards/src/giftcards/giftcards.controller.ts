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
import { GiftcardsService } from "./giftcards.service";
import { CreateGiftcardDto } from "./dto/create-giftcard.dto";
import { SpendGiftcardDto } from "./dto/spend-giftcard.dto";
import { ListGiftcardsDto } from "./dto/list-giftcards.dto";

@Controller("giftcards")
export class GiftcardsController {
  constructor(private readonly giftcardsService: GiftcardsService) {}

  @Post()
  create(@Body() createGiftcardDto: CreateGiftcardDto) {
    return this.giftcardsService.create(createGiftcardDto);
  }

  @Get()
  findAll(@Query() query: ListGiftcardsDto) {
    return this.giftcardsService.findAll(query);
  }

  @Get("summary")
  summary() {
    return this.giftcardsService.summary();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.giftcardsService.findOne(id);
  }

  @Post(":id/spend")
  spend(
    @Param("id", ParseIntPipe) id: number,
    @Body() spendGiftcardDto: SpendGiftcardDto,
  ) {
    return this.giftcardsService.spend(id, spendGiftcardDto.amount);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.giftcardsService.remove(id);
  }
}
