import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { VoucherAdminController } from './voucher-admin.controller';
import { VoucherController, WalletController } from './voucher.controller';
import { VoucherService } from './voucher.service';

/**
 * Voucher module (owns the `voucher` schema). Imports CartModule so the storefront
 * preview can read the caller's live cart subtotal server-side (no trusted FE
 * amount). UserService (for wallet grants) comes from the global IamModule.
 * VoucherService is exported so OrderModule can validate/redeem at checkout
 * in-process — vouchers are never JOINed from the ordering schema.
 */
@Module({
  imports: [CartModule],
  controllers: [VoucherAdminController, VoucherController, WalletController],
  providers: [VoucherService],
  exports: [VoucherService],
})
export class VoucherModule {}
