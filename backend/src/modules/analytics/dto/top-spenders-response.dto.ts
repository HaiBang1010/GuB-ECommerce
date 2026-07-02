import { ApiProperty } from '@nestjs/swagger';

// A top-spending customer in the window. `totalSpentCents` sums paid orders only
// (SPENT_STATUSES). `email`/`name` are resolved in-process via UserService and are
// null when the user id no longer resolves (e.g. demo/seed ids).
export class TopSpenderDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01' })
  userId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'user@example.com' })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Nguyễn Văn A' })
  name!: string | null;

  @ApiProperty({ example: 456700, description: 'Total spent in integer cents.' })
  totalSpentCents!: number;

  @ApiProperty({ example: 6 })
  orderCount!: number;
}
