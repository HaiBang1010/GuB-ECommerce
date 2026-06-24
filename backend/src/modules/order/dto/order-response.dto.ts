import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

// Immutable shipping-address snapshot stored on the order (Order.shippingAddress
// JSON). A copy, not a reference to iam.Address.
export class ShippingAddressSnapshotDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName!: string;

  @ApiProperty({ example: '0901234567' })
  phone!: string;

  @ApiProperty({ example: '12 Nguyễn Huệ' })
  line1!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Tầng 3' })
  line2!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Phường Bến Nghé' })
  ward!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Quận 1' })
  district!: string | null;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  city!: string;

  @ApiProperty({ example: 'VN' })
  country!: string;

  @ApiProperty({ type: String, nullable: true, example: '700000' })
  postalCode!: string | null;
}

// Line item with price/name snapshotted at purchase time.
export class OrderItemDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9oit01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9ord01' })
  orderId!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9var01' })
  variantId!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  productId!: string;

  @ApiProperty({ example: 'Áo thun basic' })
  productNameVi!: string;

  @ApiProperty({ example: 'Basic T-Shirt' })
  productNameEn!: string;

  @ApiProperty({ example: 'M' })
  size!: string;

  @ApiProperty({ example: 'White' })
  color!: string;

  @ApiProperty({ example: 1200, description: 'Price snapshot in USD cents — 1200 = $12.00.' })
  unitPriceCents!: number;

  @ApiProperty({ example: 2 })
  quantity!: number;
}

export class OrderStatusHistoryDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9osh01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9ord01' })
  orderId!: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  status!: OrderStatus;

  @ApiProperty({ type: String, nullable: true, example: 'Payment received.' })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;
}

export class OrderResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9ord01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01' })
  userId!: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING_PAYMENT })
  status!: OrderStatus;

  @ApiProperty({ example: 2400, description: 'Items subtotal, USD cents.' })
  subtotalCents!: number;

  @ApiProperty({ example: 0, description: 'Discount applied, USD cents.' })
  discountCents!: number;

  @ApiProperty({ example: 2400, description: 'Amount charged, USD cents.' })
  totalCents!: number;

  @ApiProperty({ type: String, nullable: true, example: null })
  voucherId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  voucherCode!: string | null;

  @ApiProperty({ type: ShippingAddressSnapshotDto })
  shippingAddress!: ShippingAddressSnapshotDto;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-06-01T00:00:00.000Z' })
  placedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: () => [OrderItemDto] })
  items!: OrderItemDto[];

  @ApiProperty({ type: () => [OrderStatusHistoryDto] })
  statusHistory!: OrderStatusHistoryDto[];
}

// Result of the release-expired maintenance job.
export class ReleaseExpiredResultDto {
  @ApiProperty({ example: 3, description: 'How many expired orders were cancelled.' })
  released!: number;
}
