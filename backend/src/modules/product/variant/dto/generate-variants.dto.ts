import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ type: [String], example: ['S', 'M', 'L'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(32, { each: true })
  sizes!: string[];

  @ApiProperty({ type: [String], example: ['White', 'Black'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(48, { each: true })
  colors!: string[];

  // Applied to every generated variant. Money is integer cents — never float.
  @ApiProperty({
    example: 1200,
    description: 'Price for every generated variant, USD cents — 1200 = $12.00.',
  })
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiPropertyOptional({ example: 50, description: 'Initial stock per variant; defaults to 0.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  // Optional SKU prefix; defaults to the product slug. Generated SKUs are
  // `${prefix}-${size}-${color}`, each token uppercased to [A-Z0-9-].
  @ApiPropertyOptional({
    example: 'AO-THUN-BASIC',
    description: 'SKU prefix; defaults to the product slug (uppercased).',
  })
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
