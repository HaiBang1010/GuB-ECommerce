import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ProductModule } from './modules/product/product.module';
import { IamModule } from './modules/iam/iam.module';
import { CartModule } from './modules/cart/cart.module';
import { OrderModule } from './modules/order/order.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ProductModule,
    IamModule,
    CartModule,
    OrderModule,
  ],
})
export class AppModule {}
