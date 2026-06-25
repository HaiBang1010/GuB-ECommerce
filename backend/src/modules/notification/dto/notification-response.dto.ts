import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Channel } from '@prisma/client';

// Language-neutral payload — the frontend renders text from `type` + this via i18n.
export class NotificationPayloadDto {
  @ApiPropertyOptional({ example: 'clx1a2b3c4d5e6f7g8h9ord01' })
  orderId?: string;
}

// Response shape of a notification.Notification row. Used for OpenAPI codegen.
export class NotificationResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9ntf01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01', description: 'Recipient user id.' })
  userId!: string;

  @ApiProperty({ example: 'ORDER_SHIPPED', description: 'Discriminator the UI maps to text.' })
  type!: string;

  @ApiProperty({ type: NotificationPayloadDto, nullable: true })
  payload!: NotificationPayloadDto | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  body!: string | null;

  @ApiProperty({ enum: Channel, example: Channel.BOTH })
  channel!: Channel;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-26T00:00:00.000Z' })
  createdAt!: Date;
}

// Result of marking all notifications read.
export class MarkAllReadResponseDto {
  @ApiProperty({ example: 3, description: 'Number of notifications marked read.' })
  updated!: number;
}

// Ack returned to QStash after a consumed delivery (200 = stop retrying).
export class ConsumeResponseDto {
  @ApiProperty({ example: true })
  received!: boolean;
}
