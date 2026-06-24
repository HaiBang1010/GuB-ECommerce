import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { CreateIntentDto } from './dto/create-intent.dto';
import {
  PaymentIntentResponseDto,
  WebhookResponseDto,
} from './dto/payment-response.dto';
import { PaymentIntentResult, PaymentService } from './payment.service';

// Minimal shape of the request after `rawBody: true` — the raw Buffer is what
// Stripe signature verification needs (avoids depending on @types/express here).
interface RawBodyRequest {
  rawBody?: Buffer;
}

@ApiTags('payment')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Signed-in user starts payment for their own order.
  @ApiOperation({ summary: 'Create/reuse a Stripe PaymentIntent for an order' })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: PaymentIntentResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
  @ApiBadRequestResponse({ description: 'Order is not awaiting payment.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @UseGuards(SupabaseAuthGuard)
  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  createIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIntentDto,
  ): Promise<PaymentIntentResult> {
    return this.paymentService.createIntentForOrder(user.id, dto.orderId);
  }

  // Stripe → backend. NOT JWT-guarded: authenticity comes from the signature,
  // verified against the RAW body. Always 200 on success (incl. idempotent
  // duplicates) so Stripe stops retrying.
  @ApiOperation({
    summary: 'Stripe webhook (signature-verified, raw body — not JWT-guarded)',
  })
  @ApiOkResponse({ type: WebhookResponseDto })
  @ApiBadRequestResponse({ description: 'Missing body or invalid signature.' })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body.');
    }
    return this.paymentService.handleWebhook(req.rawBody, signature);
  }
}
