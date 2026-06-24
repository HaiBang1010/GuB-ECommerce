import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Lowercase kebab-case: "air-zoom-pegasus", "oversized-tee".
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// No PartialType (@nestjs/mapped-types is not installed) → fields are spelled out.
export class UpdateProductDto {
  // Re-categorize; existence/active-state is validated in the service.
  @ApiPropertyOptional({ example: 'clx1a2b3c4d5e6f7g8h9cat01' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Áo thun basic' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameVi?: string;

  @ApiPropertyOptional({ example: 'Basic T-Shirt' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameEn?: string;

  @ApiPropertyOptional({ example: 'ao-thun-basic' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug?: string;

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

  @ApiPropertyOptional({
    example: 1200,
    description: 'Base price in USD cents — 1200 = $12.00.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  basePriceCents?: number;

  // `null` clears the sale price; a number sets it; absent leaves it untouched.
  // ValidateIf lets an explicit null bypass the @IsInt check; the service
  // distinguishes the three cases via `'salePriceCents' in dto`.
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 999,
    description: 'Sale price in USD cents; null clears the sale. 999 = $9.99.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateProductDto) => o.salePriceCents !== null)
  @IsInt()
  @Min(0)
  salePriceCents?: number | null;
}
