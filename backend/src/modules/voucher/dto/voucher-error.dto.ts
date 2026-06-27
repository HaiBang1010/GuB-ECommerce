import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Discriminators on the structured voucher-error body, so the storefront can map
// each failure to its own i18n message (and tell it apart from a payment/stock error).
export enum VoucherErrorCode {
  NOT_FOUND = 'VOUCHER_NOT_FOUND',
  NOT_YET_VALID = 'VOUCHER_NOT_YET_VALID',
  EXPIRED = 'VOUCHER_EXPIRED',
  MIN_ORDER_NOT_MET = 'VOUCHER_MIN_ORDER_NOT_MET',
  USED_UP = 'VOUCHER_USED_UP',
  USER_LIMIT = 'VOUCHER_USER_LIMIT',
  NOT_AVAILABLE = 'VOUCHER_NOT_AVAILABLE',
}

// 4xx body returned when a voucher can't be applied (preview or place-order). The
// `code` lets the storefront pick the message; `minOrderCents` is present only for
// MIN_ORDER_NOT_MET. Shape mirrors the literal thrown by VoucherService.fail().
export class VoucherErrorDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: 'This voucher has expired.' })
  message!: string;

  @ApiProperty({ enum: VoucherErrorCode, example: VoucherErrorCode.EXPIRED })
  code!: VoucherErrorCode;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Minimum order subtotal in cents — only on VOUCHER_MIN_ORDER_NOT_MET.',
  })
  minOrderCents?: number;
}
