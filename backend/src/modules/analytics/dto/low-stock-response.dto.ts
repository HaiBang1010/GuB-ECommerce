import { ApiProperty } from '@nestjs/swagger';

// An active variant at or below the stock threshold — an operational restock
// warning. Only variants of active/visible products appear (nothing to restock for
// an archived product). Names come from ProductService (in-process).
export class LowStockVariantDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9var01' })
  variantId!: string;

  @ApiProperty({ example: 'DEMO-GIAY-SNEAKER-CLASSIC-42-WHITE' })
  sku!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  productId!: string;

  @ApiProperty({ example: 'Giày sneaker cổ điển' })
  nameVi!: string;

  @ApiProperty({ example: 'Classic sneaker' })
  nameEn!: string;

  @ApiProperty({ example: '42' })
  size!: string;

  @ApiProperty({ example: 'White' })
  color!: string;

  @ApiProperty({ example: 2 })
  stockQty!: number;
}
