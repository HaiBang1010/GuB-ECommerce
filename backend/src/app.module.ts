import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ProductModule } from './modules/product/product.module';
import { IamModule } from './modules/iam/iam.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReviewModule } from './modules/review/review.module';
import { NotificationModule } from './modules/notification/notification.module';
import { VoucherModule } from './modules/voucher/voucher.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ProductModule,
    IamModule,
    CartModule,
    OrderModule,
    PaymentModule,
    ReviewModule,
    NotificationModule,
    VoucherModule,
    MarketingModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
