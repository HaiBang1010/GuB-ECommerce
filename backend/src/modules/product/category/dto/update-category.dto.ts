import { ApiPropertyOptional } from '@nestjs/swagger';
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

// No PartialType (@nestjs/mapped-types is not installed) → fields are spelled out.
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Áo thun' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi?: string;

  @ApiPropertyOptional({ example: 'T-Shirts' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn?: string;

  @ApiPropertyOptional({ example: 'ao-thun', description: 'Lowercase kebab-case.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug?: string;

  // Cover image URL; null clears it. ValidateIf lets an explicit null bypass @IsUrl;
  // the service distinguishes the three cases via `'imageUrl' in dto`.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://res.cloudinary.com/demo/image/upload/v1/gub/categories/tops.jpg',
    description: 'Cover image URL for the home category grid; null clears it.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.imageUrl !== null)
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string | null;

  // `null` explicitly moves the category to root; a string re-parents it; absent
  // leaves the parent untouched. ValidateIf lets an explicit null bypass the
  // string checks; the service distinguishes the three cases via `'parentId' in dto`.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'clx1a2b3c4d5e6f7g8h9cat01',
    description: 'Parent category id; null moves it to root.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.parentId !== null)
  @IsString()
  @IsNotEmpty()
  parentId?: string | null;

  // Size chart system for the rule-based size suggestion (null clears it). The
  // size→measurement ranges are code constants; this only picks which chart applies.
  @ApiPropertyOptional({
    enum: SizeSystem,
    nullable: true,
    description: 'Size system for size suggestion; null clears it.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.sizeSystem !== null)
  @IsEnum(SizeSystem)
  sizeSystem?: SizeSystem | null;
}
