import { Transform } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { MAX_USER_EMAIL_LENGTH } from "../giftcards.constants";

const MAX_PAGE = Math.floor(Number.MAX_SAFE_INTEGER / 100);

function transformDecimalInteger(value: unknown): unknown {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

export class ListGiftcardsDto {
  @ApiPropertyOptional({
    type: "string",
    description: "Filter by recipient email",
    example: "receiver@example.com",
    maxLength: MAX_USER_EMAIL_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_USER_EMAIL_LENGTH)
  userEmail?: string;

  @ApiPropertyOptional({
    type: "integer",
    format: "int64",
    description: "One-based page number",
    default: 1,
    minimum: 1,
    maximum: MAX_PAGE,
    example: 1,
  })
  @Transform(({ value }) => transformDecimalInteger(value), {
    toClassOnly: true,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @IsPositive()
  @Max(MAX_PAGE)
  page = 1;

  @ApiPropertyOptional({
    type: "integer",
    format: "int32",
    description: "Items per page; capped at 100",
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @Transform(({ value }) => transformDecimalInteger(value), {
    toClassOnly: true,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @IsPositive()
  @Max(100)
  limit = 20;
}
