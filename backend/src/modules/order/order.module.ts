import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { ProductModule } from '../product/product.module';
import { NotificationModule } from '../notification/notification.module';
import { VoucherModule } from '../voucher/voucher.module';
import { OrderAdminController } from './order-admin.controller';
import { OrderJobsController } from './order-jobs.controller';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

/**
 * Ordering module (owns the `ordering` schema). Imports ProductModule (variant
 * stock + product snapshots), CartModule (read + clear the cart) and VoucherModule
 * (validate + redeem a voucher at checkout) to collaborate in-process — it never
 * queries those schemas directly. AddressService and the auth guards come from the
 * global IamModule.
 */
@Module({
  imports: [ProductModule, CartModule, NotificationModule, VoucherModule],
  controllers: [OrderController, OrderAdminController, OrderJobsController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
