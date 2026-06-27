import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  // The shipping address must belong to the caller; verified in the service via
  // AddressService (404 on mismatch).
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9adr01',
    description: "One of the caller's address ids; snapshotted onto the order.",
  })
  @IsString()
  @IsNotEmpty()
  addressId!: string;

  // Optional voucher code. Re-validated server-side against the live cart subtotal
  // and redeemed inside the checkout transaction (the FE preview is non-binding).
  @ApiPropertyOptional({
    example: 'SUMMER10',
    description: 'Voucher code to apply; re-validated + redeemed at place-order.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  voucherCode?: string;
}
