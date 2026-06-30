import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SizeSystem } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Lowercase kebab-case: "tops", "running-shoes".
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @ApiProperty({ example: 'Áo thun' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi!: string;

  @ApiProperty({ example: 'T-Shirts' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn!: string;

  @ApiProperty({ example: 'ao-thun', description: 'Lowercase kebab-case, unique.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug!: string;

  // Cover image for the storefront category grid (external URL — admin pastes it).
  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/gub/categories/tops.jpg',
    description: 'Cover image URL for the home category grid (optional).',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  // Existence/active-state is validated in the service, not here.
  @ApiPropertyOptional({
    example: 'clx1a2b3c4d5e6f7g8h9cat01',
    description: 'Parent category id; omit for a root category.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parentId?: string;

  // Size chart system for the rule-based size suggestion (omit / null = none).
  @ApiPropertyOptional({
    enum: SizeSystem,
    nullable: true,
    description: 'Size system for size suggestion; omit for none.',
  })
  @IsOptional()
  @ValidateIf((o: CreateCategoryDto) => o.sizeSystem !== null)
  @IsEnum(SizeSystem)
  sizeSystem?: SizeSystem | null;
}
