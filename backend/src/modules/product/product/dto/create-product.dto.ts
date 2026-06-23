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
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameVi!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug!: string;

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

  // Money is integer cents — never float. Variant-level prices come later with
  // the Variant slice; this is the product's base price.
  @IsInt()
  @Min(0)
  basePriceCents!: number;

  // Optional sale price; the service enforces salePriceCents < basePriceCents.
  @IsOptional()
  @IsInt()
  @Min(0)
  salePriceCents?: number;
}
