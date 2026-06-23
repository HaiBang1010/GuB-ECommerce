import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

// Defensive upper bound on a single add; real availability is checked against
// live stock in the service.
const MAX_QUANTITY = 999;

export class AddCartItemDto {
  // Existence/purchasability of the variant is validated in the service via
  // ProductVariantService, not here.
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}
