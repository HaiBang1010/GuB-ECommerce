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

// Lowercase kebab-case: "air-zoom-pegasus", "oversized-tee".
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateProductDto {
  // Existence/active-state of the category is validated in the service
  // (via CategoryService), not here.
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9cat01',
    description: 'Category id this product belongs to.',
  })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ example: 'Áo thun basic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameVi!: string;

  @ApiProperty({ example: 'Basic T-Shirt' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameEn!: string;

  @ApiProperty({
    example: 'ao-thun-basic',
    description: 'Lowercase kebab-case, unique.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'Áo thun cotton 100%, form regular.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionVi?: string;

  @ApiPropertyOptional({ example: '100% cotton t-shirt, regular fit.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionEn?: string;

  @ApiPropertyOptional({ example: 'GuB' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  // Money is integer cents — never float. Variant-level prices come later with
  // the Variant slice; this is the product's base price.
  @ApiProperty({
    example: 1200,
    description: 'Base price in USD cents — 1200 = $12.00.',
  })
  @IsInt()
  @Min(0)
  basePriceCents!: number;

  // Optional sale price; the service enforces salePriceCents < basePriceCents.
  @ApiPropertyOptional({
    example: 999,
    description: 'Sale price in USD cents, must be < basePriceCents. 999 = $9.99.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salePriceCents?: number;
}
