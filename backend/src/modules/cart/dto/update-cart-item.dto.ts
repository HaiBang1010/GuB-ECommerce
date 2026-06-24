import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

const MAX_QUANTITY = 999;

// Absolute quantity (>= 1). To remove a line, use DELETE /cart/items/:variantId.
export class UpdateCartItemDto {
  @ApiProperty({ example: 3, description: 'New absolute quantity (>= 1).' })
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}
