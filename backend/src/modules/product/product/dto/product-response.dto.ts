import { ApiProperty } from '@nestjs/swagger';

// Response shape of a product.Product row (the internal `search_tsv` column is
// never serialized). Used for OpenAPI codegen.
export class ProductResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9cat01' })
  categoryId!: string;

  @ApiProperty({ example: 'Áo thun basic' })
  nameVi!: string;

  @ApiProperty({ example: 'Basic T-Shirt' })
  nameEn!: string;

  @ApiProperty({ example: 'ao-thun-basic' })
  slug!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Áo thun cotton 100%, form regular.' })
  descriptionVi!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '100% cotton t-shirt, regular fit.' })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'GuB' })
  brand!: string | null;

  @ApiProperty({ example: 1200, description: 'Base price in USD cents — 1200 = $12.00.' })
  basePriceCents!: number;

  @ApiProperty({ type: Number, nullable: true, example: 999, description: 'Sale price in USD cents; null = not on sale.' })
  salePriceCents!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  updatedAt!: Date;
}
