import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto {
  // The shipping address must belong to the caller; verified in the service via
  // AddressService (404 on mismatch).
  @IsString()
  @IsNotEmpty()
  addressId!: string;
}
