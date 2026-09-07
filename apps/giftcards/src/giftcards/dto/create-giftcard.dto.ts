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
import { ApiProperty } from "@nestjs/swagger";
import { MAX_STORE_ID_LENGTH } from "../giftcards.constants";

export class CreateGiftcardDto {
  @ApiProperty({
    type: "integer",
    format: "int64",
    description: "Issued amount in positive integer cents",
    example: 5000,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @IsNumber()
  @IsPositive()
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;

  @ApiProperty({ example: "Birthday gift" })
  @IsString()
  description: string;

  @ApiProperty({
    description: "ISO 8601 expiration timestamp",
    example: "2030-01-01T00:00:00.000Z",
  })
  @IsDateString()
  expiresAt: string;

  @ApiProperty({ example: "store-1", maxLength: MAX_STORE_ID_LENGTH })
  @IsString()
  @MaxLength(MAX_STORE_ID_LENGTH)
  storeId: string;

  @ApiProperty({
    description: "Recipient email address",
    example: "receiver@example.com",
  })
  @IsString()
  receriverEmail: string;
}
