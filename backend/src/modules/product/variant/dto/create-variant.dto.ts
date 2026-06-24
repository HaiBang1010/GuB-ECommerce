import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// Uppercase alphanumeric segments joined by hyphens: "SNEAKER-42-RED".
export const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export class CreateVariantDto {
  // Existence of the product is validated in the service (via ProductService).
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9prd01',
    description: 'Product id this variant belongs to.',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    example: 'AO-THUN-BASIC-M-WHITE',
    description: 'Uppercase alphanumeric segments joined by hyphens; unique.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase alphanumeric segments separated by hyphens.',
  })
  sku!: string;

  // Free-text so the admin can enter new values ("42", "M", "XL", "One Size").
  @ApiProperty({ example: 'M' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  size!: string;

  @ApiProperty({ example: 'White' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color!: string;

  // Variant-level price; money is integer cents — never float.
  @ApiProperty({
    example: 1200,
    description: 'Variant price in USD cents — 1200 = $12.00.',
  })
  @IsInt()
  @Min(0)
  priceCents!: number;

  // Per-variant stock; defaults to 0 (out of stock until restocked).
  @ApiPropertyOptional({ example: 50, description: 'Units in stock; defaults to 0.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;
}
