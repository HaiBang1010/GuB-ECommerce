import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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

  // Existence/active-state is validated in the service, not here.
  @ApiPropertyOptional({
    example: 'clx1a2b3c4d5e6f7g8h9cat01',
    description: 'Parent category id; omit for a root category.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parentId?: string;
}
