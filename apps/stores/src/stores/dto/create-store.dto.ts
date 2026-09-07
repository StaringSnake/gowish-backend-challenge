import { IsString, IsNotEmpty, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateStoreDto {
  @ApiProperty({ example: "Example Store" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "Two-letter country code",
    example: "US",
    minLength: 2,
    maxLength: 2,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  countryCode: string;

  @ApiProperty({ example: "1 Main Street" })
  @IsString()
  @IsNotEmpty()
  address: string;
}
