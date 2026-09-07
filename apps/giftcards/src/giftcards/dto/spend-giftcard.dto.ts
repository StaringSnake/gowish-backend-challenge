import { IsInt, IsNumber, IsPositive, Max } from "class-validator";

export class SpendGiftcardDto {
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;
}
