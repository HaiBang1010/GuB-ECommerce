import { ApiProperty } from '@nestjs/swagger';
import { ReviewResponseDto } from './review-response.dto';

export class ReviewSummaryDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.5,
    description: 'Average rating, or null when the product has no reviews.',
  })
  average!: number | null;

  @ApiProperty({ example: 12, description: 'Number of reviews for the product.' })
  count!: number;
}

// Public storefront payload: a product's rating aggregate + its reviews.
export class ProductReviewsResponseDto {
  @ApiProperty({ type: ReviewSummaryDto })
  summary!: ReviewSummaryDto;

  @ApiProperty({ type: [ReviewResponseDto] })
  items!: ReviewResponseDto[];
}
