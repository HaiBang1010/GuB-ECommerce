import { ApiProperty } from '@nestjs/swagger';

// Units + revenue rolled up per category in the window. Built by mapping each sold
// product (from order-item snapshots) to its category via ProductService, then
// naming the category via CategoryService — all in-process, no cross-schema JOIN.
// `categoryId` is 'uncategorized' for the (rare) product whose category no longer
// resolves.
export class SalesByCategoryDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9cat01' })
  categoryId!: string;

  @ApiProperty({ example: 'Áo' })
  nameVi!: string;

  @ApiProperty({ example: 'Tops' })
  nameEn!: string;

  @ApiProperty({ example: 120 })
  unitsSold!: number;

  @ApiProperty({ example: 240000, description: 'Revenue in integer cents.' })
  revenueCents!: number;
}
