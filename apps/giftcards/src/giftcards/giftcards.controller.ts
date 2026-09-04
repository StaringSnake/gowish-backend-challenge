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

@Controller("giftcards")
export class GiftcardsController {
  constructor(private readonly giftcardsService: GiftcardsService) {}

  @Post()
  create(@Body() createGiftcardDto: CreateGiftcardDto) {
    return this.giftcardsService.create(createGiftcardDto);
  }

  @Get()
  findAll(@Query("userEmail") userEmail?: string) {
    if (userEmail) {
      return this.giftcardsService.findByUserEmail(userEmail);
    }
    return this.giftcardsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.giftcardsService.findOne(id);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.giftcardsService.remove(id);
  }
}
