import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { ProductModule } from '../product/product.module';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Read-only admin analytics. Imports OrderModule (the `ordering` aggregations) and
 * ProductModule (category naming + low-stock via ProductService/CategoryService/
 * ProductVariantService); UserService comes free from the @Global IamModule.
 * AnalyticsService only orchestrates those services in-process — it never queries
 * another schema, and NOTHING imports AnalyticsModule (no dependency cycle, §3).
 */
@Module({
  imports: [OrderModule, ProductModule],
  controllers: [AnalyticsAdminController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
