import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';

/**
 * Payment module (owns the `payment` schema: Payment + StripeEvent ledger).
 * Imports OrderModule to read orders and mark them PAID in-process. Auth guard
 * comes from the global IamModule.
 */
@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService, StripeService],
  exports: [PaymentService],
})
export class PaymentModule {}
