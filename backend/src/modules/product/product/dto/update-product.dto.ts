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
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameVi?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionVi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  basePriceCents?: number;

  // `null` clears the sale price; a number sets it; absent leaves it untouched.
  // ValidateIf lets an explicit null bypass the @IsInt check; the service
  // distinguishes the three cases via `'salePriceCents' in dto`.
  @IsOptional()
  @ValidateIf((o: UpdateProductDto) => o.salePriceCents !== null)
  @IsInt()
  @Min(0)
  salePriceCents?: number | null;
}
