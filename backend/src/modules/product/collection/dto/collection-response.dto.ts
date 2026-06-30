import { ApiProperty } from '@nestjs/swagger';

// Response shape of a product.Collection row. Used for OpenAPI codegen.
export class CollectionResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9col01' })
  id!: string;

  @ApiProperty({ example: 'Bộ sưu tập Hè' })
  nameVi!: string;

  @ApiProperty({ example: 'Summer Collection' })
  nameEn!: string;

  @ApiProperty({ example: 'summer' })
  slug!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://res.cloudinary.com/demo/image/upload/v1/gub/collections/summer.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({ example: false, description: 'Featured on the home page.' })
  featuredOnHome!: boolean;

  @ApiProperty({ example: 0, description: 'Home ordering (ascending).' })
  homeSortOrder!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-06-01T00:00:00.000Z' })
  validFrom!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-08-31T23:59:59.000Z' })
  validTo!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;
}
