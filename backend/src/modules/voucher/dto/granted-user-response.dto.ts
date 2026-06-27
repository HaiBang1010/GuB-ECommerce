import { ApiProperty } from '@nestjs/swagger';

// One user a voucher has been granted to, enriched with their email (resolved
// in-process via UserService — no cross-schema JOIN) plus whether/when they've used it.
export class GrantedUserResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01' })
  userId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'jane@example.com' })
  email!: string | null;

  @ApiProperty({ example: 0, description: "This user's redemptions of this voucher." })
  usedCount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
    description: 'Last redeemed at (null = never used).',
  })
  usedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-27T00:00:00.000Z',
  })
  grantedAt!: Date;
}
