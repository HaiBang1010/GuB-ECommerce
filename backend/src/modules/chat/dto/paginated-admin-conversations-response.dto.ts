import { ApiProperty } from '@nestjs/swagger';
import { AdminConversationResponseDto } from './admin-conversation-response.dto';

// One page of admin conversations. `total` is the count over the same search filter.
export class PaginatedAdminConversationsResponseDto {
  @ApiProperty({ type: () => [AdminConversationResponseDto] })
  items!: AdminConversationResponseDto[];

  @ApiProperty({ example: 42, description: 'Total rows matching the filter.' })
  total!: number;

  @ApiProperty({ example: 1, description: '1-based current page.' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Rows per page.' })
  pageSize!: number;
}
