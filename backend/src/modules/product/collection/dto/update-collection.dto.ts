import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SLUG_PATTERN } from './create-collection.dto';

// No PartialType (@nestjs/mapped-types is not installed) → fields are spelled out.
export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug?: string;

  // `null` clears the bound (always-on edge); a date sets it; absent leaves it
  // untouched. ValidateIf lets an explicit null bypass the @IsDate check; the
  // service distinguishes the three cases via `'validFrom' in dto`.
  @IsOptional()
  @ValidateIf((o: UpdateCollectionDto) => o.validFrom !== null)
  @Type(() => Date)
  @IsDate()
  validFrom?: Date | null;

  @IsOptional()
  @ValidateIf((o: UpdateCollectionDto) => o.validTo !== null)
  @Type(() => Date)
  @IsDate()
  validTo?: Date | null;
}
