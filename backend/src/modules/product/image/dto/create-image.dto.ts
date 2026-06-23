import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Persist an uploaded asset. The url is checked against the account prefix in the
// service; existence of the product is validated via ProductService.
export class CreateImageDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  publicId!: string;

  // Color tag matching a ProductVariant.color; omit for a generic/shared image.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
