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
  @IsOptional()
  @IsString()
  @MaxLength(MAX_USER_EMAIL_LENGTH)
  userEmail?: string;

  @Transform(({ value }) => transformDecimalInteger(value), {
    toClassOnly: true,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @IsPositive()
  @Max(MAX_PAGE)
  page = 1;

  @Transform(({ value }) => transformDecimalInteger(value), {
    toClassOnly: true,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsInt()
  @IsPositive()
  @Max(100)
  limit = 20;
}
