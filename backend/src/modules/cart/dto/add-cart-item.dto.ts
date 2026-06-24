import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

// Defensive upper bound on a single add; real availability is checked against
// live stock in the service.
const MAX_QUANTITY = 999;

export class AddCartItemDto {
  // Existence/purchasability of the variant is validated in the service via
  // ProductVariantService, not here.
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9var01',
    description: 'Variant id to add.',
  })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 2, description: 'Quantity to add (capped at live stock).' })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}
