import { ApiProperty } from '@nestjs/swagger';

export class PaymentIntentResponseDto {
  @ApiProperty({
    example: 'pi_3Nabc123_secret_xyz456',
    description: 'Stripe PaymentIntent client secret; the browser confirms with it.',
  })
  clientSecret!: string;

  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9pay01',
    description: 'GuB Payment record id (cuid) — NOT the Stripe pi_ id.',
  })
  paymentRecordId!: string;
}

export class WebhookResponseDto {
  @ApiProperty({ example: true })
  received!: boolean;
}
