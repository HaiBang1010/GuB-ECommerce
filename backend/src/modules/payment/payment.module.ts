import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { PaymentAdminController } from './payment-admin.controller';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';

/**
 * Payment module (owns the `payment` schema: Payment + StripeEvent ledger).
 * Imports OrderModule to read orders, mark them PAID, and refund them in-process
 * (markPaid / markRefunded). The admin refund route lives here (PaymentAdminController)
 * so OrderModule never has to import PaymentModule (which would be a cycle). Auth
 * guard comes from the global IamModule.
 */
@Module({
  imports: [OrderModule],
  controllers: [PaymentController, PaymentAdminController],
  providers: [PaymentService, StripeService],
  exports: [PaymentService],
})
export class PaymentModule {}
