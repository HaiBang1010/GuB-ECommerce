import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

// A user's notifications (newest first) plus the unread count for the bell badge.
export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ example: 2, description: 'Number of unread notifications.' })
  unreadCount!: number;
}
