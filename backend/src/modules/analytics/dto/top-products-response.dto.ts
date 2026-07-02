import { ApiProperty } from '@nestjs/swagger';

// A best-selling product in the window, ranked by revenue. Names come from the order
// item SNAPSHOT (§4.4), so this needs no product lookup. `revenueCents` = Σ
// unitPriceCents*quantity across paid orders (SPENT_STATUSES).
export class TopProductDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  productId!: string;

  @ApiProperty({ example: 'Áo thun cổ tròn' })
  nameVi!: string;

  @ApiProperty({ example: 'Crew-neck T-shirt' })
  nameEn!: string;

  @ApiProperty({ example: 48 })
  unitsSold!: number;

  @ApiProperty({ example: 96000, description: 'Revenue in integer cents.' })
  revenueCents!: number;
}
