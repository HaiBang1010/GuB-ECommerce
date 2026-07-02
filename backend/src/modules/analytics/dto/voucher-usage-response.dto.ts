import { ApiProperty } from '@nestjs/swagger';

// One voucher's redemption footprint on paid orders in the window, from the order
// snapshot (`voucherCode` + `discountCents`, §4.4). `discountCents` is the total
// discount actually granted through that code.
export class VoucherUsageDto {
  @ApiProperty({ example: 'SAVE10' })
  voucherCode!: string;

  @ApiProperty({ example: 8, description: 'Paid orders that used this voucher.' })
  orderCount!: number;

  @ApiProperty({ example: 12000, description: 'Total discount in integer cents.' })
  discountCents!: number;
}
