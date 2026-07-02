import { ApiProperty } from '@nestjs/swagger';
import { Sender } from '@prisma/client';

// One persisted chat message. `sender` distinguishes the customer from the admin;
// `readAt` is null until the other side acks it.
export class ChatMessageResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9msg01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9cnv01' })
  conversationId!: string;

  @ApiProperty({ enum: Sender, example: Sender.USER })
  sender!: Sender;

  @ApiProperty({ example: 'Hi, is this available in size 42?' })
  body!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
    description: 'When the recipient marked it read (null = unread).',
  })
  readAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-02T10:15:00.000Z',
  })
  createdAt!: Date;
}
