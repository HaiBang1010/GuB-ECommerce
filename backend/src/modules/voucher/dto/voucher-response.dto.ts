import { ApiProperty } from '@nestjs/swagger';
import { VoucherType } from '@prisma/client';

// Full voucher row for admin management. Money fields are integer cents.
export class VoucherResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9vch01' })
  id!: string;

  @ApiProperty({ example: 'SUMMER10' })
  code!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Giảm 10% mùa hè' })
  titleVi!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Summer 10% off' })
  titleEn!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Áp dụng cho mọi đơn hàng.' })
  descriptionVi!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Applies to all orders.' })
  descriptionEn!: string | null;

  @ApiProperty({ enum: VoucherType, example: VoucherType.PERCENT })
  type!: VoucherType;

  @ApiProperty({ example: true, description: 'false = wallet-only (granted).' })
  isPublic!: boolean;

  @ApiProperty({ example: 10, description: 'PERCENT: 1..100. FIXED: cents off.' })
  value!: number;

  @ApiProperty({ type: Number, nullable: true, example: 5000 })
  minOrderCents!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 2000 })
  maxDiscountCents!: number | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-07-01T00:00:00.000Z',
  })
  validFrom!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-08-01T00:00:00.000Z',
  })
  validTo!: Date | null;

  @ApiProperty({ type: Number, nullable: true, example: 100 })
  usageLimit!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 1 })
  perUserLimit!: number | null;

  @ApiProperty({ example: 7, description: 'Global redemptions so far.' })
  usedCount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  archivedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-27T00:00:00.000Z',
  })
  createdAt!: Date;
}
