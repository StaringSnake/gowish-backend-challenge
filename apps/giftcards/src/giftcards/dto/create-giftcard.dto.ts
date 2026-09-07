import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsInt,
  IsDateString,
  Max,
} from "class-validator";

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
  storeId: string;

  @IsString()
  receriverEmail: string;
}
