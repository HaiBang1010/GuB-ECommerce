import { ApiProperty } from '@nestjs/swagger';
import { ConversationResponseDto } from './chat-thread-response.dto';

// The customer's identity, resolved in-process via UserService (no cross-schema
// JOIN); null when the referenced iam.User row is gone.
export class ChatCustomerDto {
  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Jane Doe' })
  name!: string | null;
}

// An admin conversation row: the conversation plus the enriched customer and the
// unread customer→admin message count (for a badge in the admin inbox).
export class AdminConversationResponseDto extends ConversationResponseDto {
  @ApiProperty({ type: () => ChatCustomerDto, nullable: true })
  customer!: ChatCustomerDto | null;

  @ApiProperty({ example: 3, description: 'Unread customer→admin messages.' })
  unreadCount!: number;
}
