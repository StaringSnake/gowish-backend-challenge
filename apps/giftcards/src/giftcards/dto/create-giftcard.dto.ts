import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsDateString,
} from "class-validator";

export class CreateGiftcardDto {
  @IsNumber()
  @IsPositive()
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
