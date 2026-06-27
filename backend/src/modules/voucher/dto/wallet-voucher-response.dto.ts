import { ApiProperty } from '@nestjs/swagger';
import { VoucherResponseDto } from './voucher-response.dto';

// A still-usable voucher in the caller's wallet: the voucher plus how many times
// THIS user has already redeemed it (against perUserLimit).
export class WalletVoucherResponseDto extends VoucherResponseDto {
  @ApiProperty({ example: 0, description: "This user's redemptions of this voucher." })
  userUsedCount!: number;
}
