import { ApiProperty } from '@nestjs/swagger';
import { OUT_OF_STOCK_CODE } from '../../product/variant/variant.service';

// One variant the order couldn't reserve, plus how many are actually left. The
// storefront resolves the display name from its cart snapshot by variantId.
export class OutOfStockItemDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9var01' })
  variantId!: string;

  @ApiProperty({ example: 0, description: 'Units currently in stock.' })
  available!: number;
}

// 409 body returned when placing an order whose items exceed live stock. The
// `code` discriminator lets the storefront tell this apart from a payment error.
// Shape is mirrored by the literal thrown in ProductVariantService.decrementForOrder.
export class OutOfStockErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'Conflict' })
  error!: string;

  @ApiProperty({ example: 'Insufficient stock for one or more items.' })
  message!: string;

  @ApiProperty({ example: OUT_OF_STOCK_CODE, enum: [OUT_OF_STOCK_CODE] })
  code!: typeof OUT_OF_STOCK_CODE;

  @ApiProperty({ type: [OutOfStockItemDto] })
  items!: OutOfStockItemDto[];
}
