import { ApiProperty } from '@nestjs/swagger';

// Storefront voucher preview result. The amounts are computed server-side from the
// caller's live cart subtotal; the FE shows them but the backend re-derives the
// real discount at place-order (this is non-binding). All money is integer cents.
export class VoucherPreviewResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9vch01' })
  voucherId!: string;

  @ApiProperty({ example: 'SUMMER10', description: 'Normalized (UPPERCASE) code.' })
  voucherCode!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Giảm 10% mùa hè' })
  titleVi!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Summer 10% off' })
  titleEn!: string | null;

  @ApiProperty({ example: 1200, description: 'Discount applied (cents).' })
  discountCents!: number;

  @ApiProperty({ example: 12000, description: 'Cart subtotal (cents).' })
  subtotalCents!: number;

  @ApiProperty({ example: 10800, description: 'subtotal − discount (cents).' })
  totalCents!: number;
}
