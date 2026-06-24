import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ example: 'AO-THUN-BASIC-M-WHITE' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase alphanumeric segments separated by hyphens.',
  })
  sku?: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  size?: string;

  @ApiPropertyOptional({ example: 'White' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color?: string;

  @ApiPropertyOptional({
    example: 1200,
    description: 'Variant price in USD cents — 1200 = $12.00.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @ApiPropertyOptional({ example: 50, description: 'Units in stock.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;
}
