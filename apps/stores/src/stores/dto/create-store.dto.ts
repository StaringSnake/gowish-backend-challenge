import { IsString, IsNotEmpty, MaxLength, MinLength } from "class-validator";

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}
