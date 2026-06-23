import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { SKU_PATTERN } from './create-variant.dto';

// Bulk-create the size×color matrix for a product. Both axes are free-text so the
// admin can introduce new sizes/colors; the service skips combos that already
// exist and auto-generates a SKU per combo.
export class GenerateVariantsDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  sizes!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(48, { each: true })
  colors!: string[];

  // Applied to every generated variant. Money is integer cents — never float.
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  // Optional SKU prefix; defaults to the product slug. Generated SKUs are
  // `${prefix}-${size}-${color}`, each token uppercased to [A-Z0-9-].
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(SKU_PATTERN, {
    message:
      'skuPrefix must be uppercase alphanumeric segments separated by hyphens.',
  })
  skuPrefix?: string;
}
