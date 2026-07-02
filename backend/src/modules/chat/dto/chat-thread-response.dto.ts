import { ApiProperty } from '@nestjs/swagger';
import { ChatMessageResponseDto } from './chat-message-response.dto';

// A conversation's own fields (no messages). `userId` is the owning customer.
export class ConversationResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9cnv01' })
  id!: string;

  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9usr01',
    description: 'Owning customer user id (scalar → iam.User.id).',
  })
  userId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-07-02T10:15:00.000Z',
    description: 'Timestamp of the most recent message (null = no messages yet).',
  })
  lastMessageAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-07-01T09:00:00.000Z',
  })
  createdAt!: Date;
}

// A conversation plus its recent message history (chronological / ascending).
export class ChatThreadResponseDto {
  @ApiProperty({ type: () => ConversationResponseDto })
  conversation!: ConversationResponseDto;

  @ApiProperty({ type: () => [ChatMessageResponseDto] })
  messages!: ChatMessageResponseDto[];
}
