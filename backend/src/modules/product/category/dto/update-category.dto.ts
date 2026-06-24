import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
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
}
