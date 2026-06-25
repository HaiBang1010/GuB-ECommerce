import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductReviewsResponseDto } from './dto/product-reviews-response.dto';
import { ProductReviews, ReviewService } from './review.service';

// Public storefront read of a product's reviews + rating aggregate. No auth — the
// storefront is browsable without login.
@ApiTags('review')
@Controller('products/:productId/reviews')
export class ProductReviewsController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiOperation({ summary: "List a product's reviews with its rating summary" })
  @ApiOkResponse({ type: ProductReviewsResponseDto })
  @Get()
  list(@Param('productId') productId: string): Promise<ProductReviews> {
    return this.reviewService.getProductReviews(productId);
  }
}
