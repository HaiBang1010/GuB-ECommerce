import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [PrismaModule, HealthModule, ProductModule],
})
export class AppModule {}
