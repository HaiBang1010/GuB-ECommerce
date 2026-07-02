import { ApiProperty } from '@nestjs/swagger';

// Result of a mark-read ack: how many messages flipped to read (idempotent → 0 if
// there was nothing unread).
export class MarkReadResponseDto {
  @ApiProperty({ example: 2, description: 'Number of messages marked read.' })
  updated!: number;
}
