import { ApiProperty } from '@nestjs/swagger';

// Response shape of a product.Category row (mirrors the Prisma model; the
// `search_tsv` column is internal and never serialized). Used for OpenAPI codegen.
export class CategoryResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9cat01' })
  id!: string;

  @ApiProperty({ example: 'Áo thun' })
  nameVi!: string;

  @ApiProperty({ example: 'T-Shirts' })
  nameEn!: string;

  @ApiProperty({ example: 'ao-thun' })
  slug!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  parentId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  updatedAt!: Date;
}

// Storefront tree node: a category plus its nested active children.
export class CategoryTreeNodeDto extends CategoryResponseDto {
  @ApiProperty({ type: () => [CategoryTreeNodeDto] })
  children!: CategoryTreeNodeDto[];
}
