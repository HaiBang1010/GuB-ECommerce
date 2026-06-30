import { Module } from '@nestjs/common';
import { MarketingAdminController } from './marketing-admin.controller';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

/**
 * Marketing module (owns the `marketing` schema → Banner). The storefront reads
 * active banners (public) and admins manage them (RoleGuard). No cross-schema JOINs.
 */
@Module({
  controllers: [MarketingAdminController, MarketingController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
