import { ApiProperty } from '@nestjs/swagger';
import { ReviewResponseDto } from './review-response.dto';

// Bilingual product name for an admin review row (null when the product is gone).
export class ReviewProductSummaryDto {
  @ApiProperty({ example: 'Áo thun' })
  nameVi!: string;

  @ApiProperty({ example: 'T-shirt' })
  nameEn!: string;
}

// The review author's identity for an admin review row (null when the user is gone).
export class ReviewerSummaryDto {
  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Jane' })
  name!: string | null;
}

// An admin review row: the raw review enriched with the product name + the
// reviewer's identity, both resolved in-process (no cross-schema JOIN).
export class AdminReviewResponseDto extends ReviewResponseDto {
  @ApiProperty({ type: ReviewProductSummaryDto, nullable: true })
  product!: ReviewProductSummaryDto | null;

  @ApiProperty({ type: ReviewerSummaryDto, nullable: true })
  reviewer!: ReviewerSummaryDto | null;
}

// One page of admin reviews. `total` is the count over the same filter.
export class PaginatedAdminReviewsResponseDto {
  @ApiProperty({ type: [AdminReviewResponseDto] })
  items!: AdminReviewResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;
}
