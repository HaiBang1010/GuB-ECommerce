import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CartService } from '../cart/cart.service';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { PreviewVoucherDto } from './dto/preview-voucher.dto';
import { VoucherErrorDto } from './dto/voucher-error.dto';
import { VoucherPreviewResponseDto } from './dto/voucher-preview-response.dto';
import { WalletVoucherResponseDto } from './dto/wallet-voucher-response.dto';
import { VoucherService, WalletVoucher } from './voucher.service';

// Storefront voucher preview. The discount is computed against the caller's LIVE
// cart subtotal (read server-side) — the FE never supplies the amount; this is a
// non-binding preview, re-validated at place-order.
@ApiTags('voucher')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('vouchers')
export class VoucherController {
  constructor(
    private readonly vouchers: VoucherService,
    private readonly cart: CartService,
  ) {}

  @ApiOperation({ summary: "Preview a voucher against the user's current cart" })
  @ApiOkResponse({ type: VoucherPreviewResponseDto })
  @ApiBadRequestResponse({
    type: VoucherErrorDto,
    description: 'The voucher is not applicable (see `code`).',
  })
  @ApiNotFoundResponse({ type: VoucherErrorDto, description: 'Voucher not found.' })
  @ApiConflictResponse({
    type: VoucherErrorDto,
    description: 'The voucher is used up / already used.',
  })
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewVoucherDto,
  ): Promise<VoucherPreviewResponseDto> {
    const cart = await this.cart.getView({ userId: user.id });
    const result = await this.vouchers.validate(
      dto.code,
      user.id,
      cart.subtotalCents,
    );
    return {
      voucherId: result.voucherId,
      voucherCode: result.voucherCode,
      titleVi: result.voucher.titleVi,
      titleEn: result.voucher.titleEn,
      discountCents: result.discountCents,
      subtotalCents: cart.subtotalCents,
      totalCents: cart.subtotalCents - result.discountCents,
    };
  }
}

// The caller's voucher wallet (still-usable granted vouchers). Mounted at
// /me/vouchers — sits beside iam's /me controller (distinct full path, no collision).
@ApiTags('voucher')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@UseGuards(SupabaseAuthGuard)
@Controller('me/vouchers')
export class WalletController {
  constructor(private readonly vouchers: VoucherService) {}

  @ApiOperation({ summary: "List the current user's usable wallet vouchers" })
  @ApiOkResponse({ type: [WalletVoucherResponseDto] })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<WalletVoucher[]> {
    return this.vouchers.listWalletForUser(user.id);
  }
}
