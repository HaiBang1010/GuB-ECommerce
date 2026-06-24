import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
}
