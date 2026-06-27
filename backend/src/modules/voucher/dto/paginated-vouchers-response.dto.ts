import { ApiProperty } from '@nestjs/swagger';
import { VoucherResponseDto } from './voucher-response.dto';

// One page of admin vouchers. `total` is the count over the same search filter.
export class PaginatedVouchersResponseDto {
  @ApiProperty({ type: () => [VoucherResponseDto] })
  items!: VoucherResponseDto[];

  @ApiProperty({ example: 42, description: 'Total rows matching the filter.' })
  total!: number;

  @ApiProperty({ example: 1, description: '1-based current page.' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Rows per page.' })
  pageSize!: number;
}
