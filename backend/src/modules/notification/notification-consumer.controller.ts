import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { ConsumeResponseDto } from './dto/notification-response.dto';
import {
  NotificationService,
  OrderStatusEvent,
} from './notification.service';
import { QStashService } from './qstash.service';

// Minimal request shape after `rawBody: true` (main.ts) — the raw bytes are what
// QStash signature verification needs (mirrors PaymentController's RawBodyRequest).
interface RawBodyRequest {
  rawBody?: Buffer;
}

@ApiTags('notification')
@Controller('notifications')
export class NotificationConsumerController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly qstash: QStashService,
  ) {}

  // QStash → backend. NOT JWT-guarded: authenticity comes from the Upstash
  // signature, verified against the RAW body. Always 200 on success (incl.
  // idempotent duplicates) so QStash stops retrying.
  @ApiOperation({
    summary: 'QStash consumer (signature-verified, raw body — not JWT-guarded)',
  })
  @ApiOkResponse({ type: ConsumeResponseDto })
  @ApiBadRequestResponse({ description: 'Missing body or invalid signature.' })
  @Post('consume')
  @HttpCode(HttpStatus.OK)
  async consume(
    @Req() req: RawBodyRequest,
    @Headers('upstash-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body.');
    }
    try {
      await this.qstash.verify(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid QStash signature.');
    }
    await this.notificationService.handleOrderStatusEvent(
      this.parseEvent(req.rawBody),
    );
    return { received: true };
  }

  private parseEvent(rawBody: Buffer): OrderStatusEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid event body.');
    }
    const event = parsed as Partial<OrderStatusEvent>;
    if (
      typeof event.orderId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.status !== 'string' ||
      !(event.status in OrderStatus)
    ) {
      throw new BadRequestException('Malformed order-status event.');
    }
    return {
      orderId: event.orderId,
      userId: event.userId,
      status: event.status as OrderStatus,
    };
  }
}
