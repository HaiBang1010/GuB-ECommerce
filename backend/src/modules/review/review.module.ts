import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { ProductModule } from '../product/product.module';
import { ProductReviewsController } from './product-reviews.controller';
import { ReviewAdminController } from './review-admin.controller';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

/**
 * Review module. Imports OrderModule + ProductModule to verify proof-of-purchase
 * (a delivered, owned order item) and validate the productId in-process — it never
 * touches the ordering/product tables directly. ReviewService is exported for
 * future slices (e.g. product-detail rating aggregation).
 */
@Module({
  imports: [OrderModule, ProductModule],
  controllers: [
    ReviewController,
    ProductReviewsController,
    ReviewAdminController,
  ],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
