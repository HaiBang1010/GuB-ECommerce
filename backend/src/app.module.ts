import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { ProductModule } from './modules/product/product.module';
import { IamModule } from './modules/iam/iam.module';

@Module({
  imports: [PrismaModule, HealthModule, ProductModule, IamModule],
})
export class AppModule {}
