import { IsInt, Max, Min } from 'class-validator';

const MAX_QUANTITY = 999;

// Absolute quantity (>= 1). To remove a line, use DELETE /cart/items/:variantId.
export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}
