import { ApiProperty } from '@nestjs/swagger';
import { VoucherResponseDto } from './voucher-response.dto';

// A still-usable voucher in the caller's wallet: the voucher plus how many times
// THIS user has already redeemed it (against perUserLimit) and the per-user deadline.
export class WalletVoucherResponseDto extends VoucherResponseDto {
  @ApiProperty({ example: 0, description: "This user's redemptions of this voucher." })
  userUsedCount!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description:
      'Per-user deadline (e.g. birthday voucher = grant + 30d). null = none; the ' +
      "voucher's own validTo applies instead.",
    example: '2026-07-30T00:00:00.000Z',
  })
  expiresAt!: Date | null;
}
