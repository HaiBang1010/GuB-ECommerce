import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Read-only admin analytics. Imports OrderModule for OrderService (the `ordering`
 * aggregations); UserService comes free from the @Global IamModule. AnalyticsService
 * only orchestrates those services in-process — it never queries another schema, and
 * NOTHING imports AnalyticsModule (no dependency cycle, ARCHITECTURE.md §3).
 */
@Module({
  imports: [OrderModule],
  controllers: [AnalyticsAdminController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
