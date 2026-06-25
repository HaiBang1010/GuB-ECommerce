import { ApiProperty } from '@nestjs/swagger';

// Response shape of a review.Review row. Used for OpenAPI codegen (no `any`).
export class ReviewResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9rev01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01', description: 'Author user id.' })
  userId!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01', description: 'Reviewed product id.' })
  productId!: string;

  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9oit01',
    description: 'Order item this review proves was purchased.',
  })
  orderItemId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Great fit, true to size.' })
  body!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  adminReply!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  adminReplyAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-25T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-25T00:00:00.000Z' })
  updatedAt!: Date;
}
