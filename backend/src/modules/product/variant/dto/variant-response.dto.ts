import { ApiProperty } from '@nestjs/swagger';

// Response shape of a product.ProductVariant row. Used for OpenAPI codegen.
export class VariantResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9var01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  productId!: string;

  @ApiProperty({ example: 'AO-THUN-BASIC-M-WHITE' })
  sku!: string;

  @ApiProperty({ example: 'M' })
  size!: string;

  @ApiProperty({ example: 'White' })
  color!: string;

  @ApiProperty({ example: 1200, description: 'Variant price in USD cents — 1200 = $12.00.' })
  priceCents!: number;

  @ApiProperty({ example: 50 })
  stockQty!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;
}

// Result of the size×color matrix generator.
export class GenerateVariantsResultDto {
  @ApiProperty({ example: 6, description: 'How many new variant rows were inserted.' })
  createdCount!: number;

  @ApiProperty({ type: () => [VariantResponseDto], description: 'Full current variant list for the product.' })
  variants!: VariantResponseDto[];
}
