import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

// Lowercase kebab-case: "running-gear", "winter-2026".
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCollectionDto {
  @ApiProperty({ example: 'Bộ sưu tập Hè' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi!: string;

  @ApiProperty({ example: 'Summer Collection' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn!: string;

  @ApiProperty({ example: 'summer', description: 'Lowercase kebab-case, unique.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug!: string;

  // Cover image for the storefront collection showcase (external URL — admin pastes it).
  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/gub/collections/summer.jpg',
    description: 'Cover image URL for the home collection showcase (optional).',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  // Home curation: feature this collection on the home page, ordered by homeSortOrder.
  @ApiPropertyOptional({ default: false, description: 'Feature on the home page.' })
  @IsOptional()
  @IsBoolean()
  featuredOnHome?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Home ordering (ascending).' })
  @IsOptional()
  @IsInt()
  homeSortOrder?: number;

  // A "season" is a Collection with a validity window: the service auto-hides it
  // on the storefront outside [validFrom, validTo]. Either bound may be omitted.
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-08-31T23:59:59.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validTo?: Date;
}
