import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Lowercase kebab-case: "running-gear", "winter-2026".
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug!: string;

  // A "season" is a Collection with a validity window: the service auto-hides it
  // on the storefront outside [validFrom, validTo]. Either bound may be omitted.
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validTo?: Date;
}
