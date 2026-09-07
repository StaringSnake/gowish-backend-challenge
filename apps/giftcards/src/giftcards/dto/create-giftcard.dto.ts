import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsInt,
  IsDateString,
  Max,
  MaxLength,
} from "class-validator";
import { MAX_STORE_ID_LENGTH } from "../giftcards.constants";

export class CreateGiftcardDto {
  @IsNumber()
  @IsPositive()
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;

  @IsString()
  description: string;

  @IsDateString()
  expiresAt: string;

  @IsString()
  @MaxLength(MAX_STORE_ID_LENGTH)
  storeId: string;

  @IsString()
  receriverEmail: string;
}
