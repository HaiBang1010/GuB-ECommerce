import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { SKU_PATTERN } from './create-variant.dto';

// productId is intentionally absent: a variant belongs to one product for life.
export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase alphanumeric segments separated by hyphens.',
  })
  sku?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  size?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;
}
