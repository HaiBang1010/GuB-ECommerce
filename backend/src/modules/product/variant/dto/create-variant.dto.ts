import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// Uppercase alphanumeric segments joined by hyphens: "SNEAKER-42-RED".
export const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export class CreateVariantDto {
  // Existence of the product is validated in the service (via ProductService).
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(SKU_PATTERN, {
    message: 'sku must be uppercase alphanumeric segments separated by hyphens.',
  })
  sku!: string;

  // Free-text so the admin can enter new values ("42", "M", "XL", "One Size").
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  size!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color!: string;

  // Variant-level price; money is integer cents — never float.
  @IsInt()
  @Min(0)
  priceCents!: number;

  // Per-variant stock; defaults to 0 (out of stock until restocked).
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;
}
