import { IsInt, IsNumber, IsPositive, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SpendGiftcardDto {
  @ApiProperty({
    type: "integer",
    format: "int64",
    description: "Spend amount in positive integer cents",
    example: 1500,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;
}
