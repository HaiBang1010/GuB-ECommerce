import { ApiProperty } from '@nestjs/swagger';

// A home banner row. Storefront reads active ones; admin reads all non-archived.
export class BannerResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9bnr01' })
  id!: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1700000000/gub/banners/summer.jpg',
  })
  imageUrl!: string;

  @ApiProperty({ type: String, nullable: true, example: '/products?category=summer' })
  linkUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Summer sale' })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Summer sale up to 50% off' })
  alt!: string | null;

  @ApiProperty({ example: 0, description: 'Display order (ascending).' })
  sortOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  archivedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-30T00:00:00.000Z',
  })
  createdAt!: Date;
}
