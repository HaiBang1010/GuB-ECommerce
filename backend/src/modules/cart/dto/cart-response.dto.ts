import { ApiProperty } from '@nestjs/swagger';

// A cart line enriched with LIVE variant data (mirrors CartItemView in the
// service). Prices reflect the current catalog, not an order snapshot.
export class CartItemViewDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9var01' })
  variantId!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  productId!: string;

  @ApiProperty({ example: 'AO-THUN-BASIC-M-WHITE' })
  sku!: string;

  @ApiProperty({ example: 'M' })
  size!: string;

  @ApiProperty({ example: 'White' })
  color!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 1200, description: 'Live unit price in USD cents — 1200 = $12.00.' })
  unitPriceCents!: number;

  @ApiProperty({ example: 2400, description: 'unitPriceCents × quantity, USD cents.' })
  lineCents!: number;

  @ApiProperty({ example: 50, description: 'Current stock for the variant.' })
  stockQty!: number;
}

export class CartViewDto {
  @ApiProperty({ type: () => [CartItemViewDto] })
  items!: CartItemViewDto[];

  @ApiProperty({ example: 2400, description: 'Sum of line totals, USD cents.' })
  subtotalCents!: number;
}
