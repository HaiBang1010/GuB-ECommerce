import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

/**
 * Cart module. Imports ProductModule to resolve variants in-process via
 * ProductVariantService (validity, live price, stock) — it never touches the
 * product tables directly. CartService is exported for the upcoming merge-on-login
 * and checkout slices.
 */
@Module({
  imports: [ProductModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
