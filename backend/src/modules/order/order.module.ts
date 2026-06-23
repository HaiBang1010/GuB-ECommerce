import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { ProductModule } from '../product/product.module';
import { OrderAdminController } from './order-admin.controller';
import { OrderJobsController } from './order-jobs.controller';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

/**
 * Ordering module (owns the `ordering` schema). Imports ProductModule (variant
 * stock + product snapshots) and CartModule (read + clear the cart) to collaborate
 * in-process — it never queries those schemas directly. AddressService and the
 * auth guards come from the global IamModule.
 */
@Module({
  imports: [ProductModule, CartModule],
  controllers: [OrderController, OrderAdminController, OrderJobsController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
